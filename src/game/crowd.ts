import * as THREE from 'three'
import type { Lane, Streets } from './streets'

const PUSH_RADIUS = 2.6
const DRAG_RADIUS = 7
const LANE_JITTER = 1.2

type Npc = {
  lane: Lane
  along: number
  offset: number
  dir: number
  speed: number
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
    private readonly streets: Streets,
  ) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.3, 0.85, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c3346, roughness: 0.62, metalness: 0.18 }),
      count,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false

    this.umbrellas = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.62, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x8ea6d8, roughness: 0.5, metalness: 0.1 }),
      count,
    )
    this.umbrellas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.umbrellas.frustumCulled = false
    this.umbrellas.visible = false

    // Seed spread along the whole lane; only respawns enter from the ends. Jun's
    // corridors are ~220 units long, so end-only spawning leaves the player alone
    // in fog for the first minute.
    for (let i = 0; i < count; i++) this.npcs.push(this.spawn(true))
    this.writeMatrices()
  }

  setRaining(raining: boolean): void {
    this.raining = raining
    this.umbrellas.visible = raining
  }

  /**
   * The escape beat: a dense mass pours down the lanes nearest `centre`, blocking
   * whatever route the player was taking.
   */
  surge(centre: THREE.Vector3, amount: number): void {
    const near = [...this.streets.lanes].sort(
      (a, b) => laneDistance(a, centre) - laneDistance(b, centre),
    )
    if (!near.length) return

    let converted = 0
    for (const n of this.npcs) {
      if (converted >= amount) break
      if (n.surge) continue

      const lane = near[converted % Math.min(4, near.length)]!
      const anchor = lane.axis === 'x' ? centre.x : centre.z

      n.lane = lane
      n.surge = true
      n.speed = 3.4 + Math.random() * 2.2
      n.offset = (Math.random() * 2 - 1) * LANE_JITTER
      n.along = THREE.MathUtils.clamp(
        anchor + (Math.random() * 2 - 1) * 26,
        lane.min,
        lane.max,
      )
      n.dir = Math.random() < 0.5 ? 1 : -1
      converted++
    }
  }

  update(dt: number, player: THREE.Vector3, density: number): void {
    const speedScale = 1 - 0.35 * density

    for (const n of this.npcs) {
      n.along += n.dir * n.speed * speedScale * dt
      if (n.along > n.lane.max || n.along < n.lane.min) {
        Object.assign(n, this.spawn())
        continue
      }

      const { x, z } = npcPosition(n)

      // Step aside rather than walk through the courier.
      const dx = x - player.x
      const dz = z - player.z
      const distSq = dx * dx + dz * dz
      if (distSq < PUSH_RADIUS * PUSH_RADIUS && distSq > 1e-4) {
        const dist = Math.sqrt(distSq)
        const push = ((PUSH_RADIUS - dist) / dist) * 0.6
        const alongPush = n.lane.axis === 'x' ? dx : dz
        const offsetPush = n.lane.axis === 'x' ? dz : dx
        n.along += alongPush * push
        n.offset = THREE.MathUtils.clamp(n.offset + offsetPush * push, -LANE_JITTER, LANE_JITTER)
      }
    }

    this.writeMatrices()
  }

  /** 0..1 resistance the player feels, from how many NPCs are pressed around them. */
  dragAt(player: THREE.Vector3): number {
    let near = 0
    for (const n of this.npcs) {
      const { x, z } = npcPosition(n)
      const dx = x - player.x
      const dz = z - player.z
      if (dx * dx + dz * dz < DRAG_RADIUS * DRAG_RADIUS) near++
    }
    return Math.min(1, near / 26)
  }

  private writeMatrices(): void {
    for (let i = 0; i < this.npcs.length; i++) {
      const { x, z } = npcPosition(this.npcs[i]!)

      this.pos.set(x, 0.72, z)
      this.matrix.compose(this.pos, this.quat, this.scale)
      this.mesh.setMatrixAt(i, this.matrix)

      if (this.raining) {
        this.pos.set(x, 1.62, z)
        this.matrix.compose(this.pos, this.quat, this.scale)
        this.umbrellas.setMatrixAt(i, this.matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.raining) this.umbrellas.instanceMatrix.needsUpdate = true
  }

  private spawn(anywhere = false): Npc {
    const lane = this.streets.lanes[Math.floor(Math.random() * this.streets.lanes.length)]!
    const dir = Math.random() < 0.5 ? 1 : -1

    return {
      lane,
      dir,
      surge: false,
      offset: (Math.random() * 2 - 1) * LANE_JITTER,
      speed: 1.5 + Math.random() * 1.5,
      along: anywhere
        ? lane.min + Math.random() * (lane.max - lane.min)
        : dir > 0
          ? lane.min + Math.random() * 6
          : lane.max - Math.random() * 6,
    }
  }
}

function npcPosition(n: Npc): { x: number; z: number } {
  return n.lane.axis === 'x'
    ? { x: n.along, z: n.lane.lane + n.offset }
    : { x: n.lane.lane + n.offset, z: n.along }
}

function laneDistance(lane: Lane, point: THREE.Vector3): number {
  return Math.abs(lane.lane - (lane.axis === 'x' ? point.z : point.x))
}
