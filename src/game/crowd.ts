import * as THREE from 'three'
import { look } from '../city/look'

const STREET_HALF = 6.5
const PUSH_RADIUS = 2.6
const DRAG_RADIUS = 7

type Npc = {
  x: number
  z: number
  /** Which axis the NPC walks along; the other axis is pinned to its lane. */
  axis: 'x' | 'z'
  lane: number
  dir: number
  speed: number
  offset: number
  surge: boolean
}

export class Crowd {
  readonly mesh: THREE.InstancedMesh
  readonly umbrellas: THREE.InstancedMesh
  private readonly npcs: Npc[] = []
  private readonly matrix = new THREE.Matrix4()
  private readonly pos = new THREE.Vector3()
  private readonly scale = new THREE.Vector3(1, 1, 1)
  private readonly quat = new THREE.Quaternion()
  private raining = false

  constructor(
    count: number,
    private readonly streetLines: number[],
    private readonly extent: number,
  ) {
    const body = new THREE.CapsuleGeometry(0.3, 0.85, 3, 8)
    this.mesh = new THREE.InstancedMesh(
      body,
      new THREE.MeshStandardMaterial({ color: 0x2c3346, roughness: 0.62, metalness: 0.18 }),
      count,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false

    const canopy = new THREE.ConeGeometry(0.62, 0.3, 10)
    this.umbrellas = new THREE.InstancedMesh(
      canopy,
      new THREE.MeshStandardMaterial({ color: 0x8ea6d8, roughness: 0.5, metalness: 0.1 }),
      count,
    )
    this.umbrellas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.umbrellas.frustumCulled = false
    this.umbrellas.visible = false

    for (let i = 0; i < count; i++) this.npcs.push(this.spawn())
    this.writeMatrices()
  }

  setRaining(raining: boolean): void {
    this.raining = raining
    this.umbrellas.visible = raining
  }

  /**
   * The escape beat: a dense mass appears near the plaza and pours outward,
   * blocking the direct route the player was probably taking.
   */
  surge(centre: THREE.Vector3, amount: number): void {
    let converted = 0
    for (const n of this.npcs) {
      if (converted >= amount) break
      if (n.surge) continue

      const lane = this.nearestLane(Math.random() < 0.5 ? centre.x : centre.z)
      n.axis = Math.random() < 0.5 ? 'x' : 'z'
      n.lane = lane
      n.surge = true
      n.speed = 3.4 + Math.random() * 2.2
      n.offset = (Math.random() * 2 - 1) * STREET_HALF

      const along = n.axis === 'x' ? centre.x : centre.z
      const jitter = (Math.random() * 2 - 1) * 26
      if (n.axis === 'x') {
        n.x = along + jitter
        n.z = lane + n.offset
      } else {
        n.z = along + jitter
        n.x = lane + n.offset
      }
      n.dir = jitter >= 0 ? 1 : -1
      converted++
    }
  }

  update(dt: number, player: THREE.Vector3, density: number): void {
    const limit = this.extent + 12
    const speedScale = 1 - 0.35 * density

    for (const n of this.npcs) {
      n.x += n.axis === 'x' ? n.dir * n.speed * speedScale * dt : 0
      n.z += n.axis === 'z' ? n.dir * n.speed * speedScale * dt : 0

      // Step aside rather than walk through the courier.
      const dx = n.x - player.x
      const dz = n.z - player.z
      const distSq = dx * dx + dz * dz
      if (distSq < PUSH_RADIUS * PUSH_RADIUS && distSq > 1e-4) {
        const dist = Math.sqrt(distSq)
        const push = ((PUSH_RADIUS - dist) / dist) * 0.9
        n.x += dx * push
        n.z += dz * push
      }

      const along = n.axis === 'x' ? n.x : n.z
      if (along > limit || along < -limit) {
        Object.assign(n, this.spawn())
      }
    }

    this.writeMatrices()
  }

  /** 0..1 resistance the player feels, from how many NPCs are pressed around them. */
  dragAt(player: THREE.Vector3): number {
    let near = 0
    for (const n of this.npcs) {
      const dx = n.x - player.x
      const dz = n.z - player.z
      if (dx * dx + dz * dz < DRAG_RADIUS * DRAG_RADIUS) near++
    }
    return Math.min(1, near / 26)
  }

  private writeMatrices(): void {
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]!
      this.pos.set(n.x, 0.72, n.z)
      this.matrix.compose(this.pos, this.quat, this.scale)
      this.mesh.setMatrixAt(i, this.matrix)

      if (this.raining) {
        this.pos.y = 1.62
        this.matrix.compose(this.pos, this.quat, this.scale)
        this.umbrellas.setMatrixAt(i, this.matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.raining) this.umbrellas.instanceMatrix.needsUpdate = true
  }

  private spawn(): Npc {
    const axis: 'x' | 'z' = Math.random() < 0.5 ? 'x' : 'z'
    const lane = this.streetLines[Math.floor(Math.random() * this.streetLines.length)] ?? 0
    const offset = (Math.random() * 2 - 1) * STREET_HALF
    const dir = Math.random() < 0.5 ? 1 : -1
    const along = -dir * (this.extent + Math.random() * 10)

    return {
      axis,
      lane,
      dir,
      offset,
      surge: false,
      speed: 1.5 + Math.random() * 1.5,
      x: axis === 'x' ? along : lane + offset,
      z: axis === 'x' ? lane + offset : along,
    }
  }

  private nearestLane(value: number): number {
    let best = this.streetLines[0] ?? 0
    for (const line of this.streetLines) {
      if (Math.abs(line - value) < Math.abs(best - value)) best = line
    }
    return best
  }
}

export function makeRain(): { points: THREE.Points; update: (dt: number, centre: THREE.Vector3) => void } {
  const count = look.rainCount
  const positions = new Float32Array(count * 3)
  const spread = 90

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * spread
    positions[i * 3 + 1] = Math.random() * 60
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * spread
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: look.rainColor,
      size: 0.13,
      transparent: true,
      opacity: look.rainOpacity,
      depthWrite: false,
    }),
  )
  points.visible = false
  points.frustumCulled = false

  const update = (dt: number, centre: THREE.Vector3) => {
    if (!points.visible) return
    const arr = geometry.attributes.position!.array as Float32Array
    for (let i = 0; i < count; i++) {
      const y = i * 3 + 1
      arr[y]! -= look.rainSpeed * dt
      if (arr[y]! < 0) {
        arr[y] = 55 + Math.random() * 8
        arr[i * 3] = centre.x + (Math.random() * 2 - 1) * spread
        arr[i * 3 + 2] = centre.z + (Math.random() * 2 - 1) * spread
      }
    }
    geometry.attributes.position!.needsUpdate = true
  }

  return { points, update }
}
