import * as THREE from 'three'
import { humanoidGeometry } from './humanoid'
import type { Lane, Streets } from './streets'

const JACKETS = [0x2c3346, 0x3a2a3d, 0x2b3a2e, 0x4a2f2a, 0x1e2a3a, 0x3d3540, 0x2a3540]

const PUSH_RADIUS = 2.6
const DRAG_RADIUS = 7
const LANE_JITTER = 1.2

// Crowd calibration knobs — a real crowd needs tuning a uniform model can't fake.
const LANE_BOUND = 1.6 // max lateral offset incl. weave; widened past LANE_JITTER so weave reads
const WEAVE_AMP = 0.7 // lateral sine-weave amplitude (units)
const SPEED_WOBBLE = 0.14 // per-frame pace jitter so no two people lock step
const PAUSE_RATE = 0.035 // per-second chance a walker stops to idle
const PAUSE_MIN = 1.0
const PAUSE_MAX = 4.0

// The scramble: a fraction of the crowd works the open intersection instead of the
// corridors — they wait at the curbs, then on green pour across to a *different* edge,
// so paths cross diagonally in the middle. This is the signature Shibuya read.
const CROSSER_FRACTION = 0.5
const SQUARE = 22 // half-extent of the open crossing, world units (curbs sit here)
export const CROSS_WALK = 11 // green seconds
export const CROSS_WAIT = 7 // red seconds
const CROSS_STAGGER = 1.6 // max random delay after green so the flood isn't a lockstep pulse

const UP = new THREE.Vector3(0, 1, 0)

type Npc = {
  mode: 'lane' | 'cross'
  px: number // resolved world position, written by update, read by draw/drag
  pz: number
  yaw: number // facing, so the crowd isn't all oriented the same way
  scale: number // overall build
  scaleY: number // height, slightly independent of build
  weaveAmp: number
  weaveFreq: number
  phase: number
  baseSpeed: number
  surge: boolean

  // lane mode
  lane: Lane
  along: number
  offset: number // lateral "home", moved only by player push
  dir: number
  pause: number

  // cross mode
  fromX: number
  fromZ: number
  fromSide: number
  toX: number
  toZ: number
  crossLen: number
  p: number // 0 waiting at curb, 1 arrived at far curb
  walking: boolean
  crossDelay: number // stagger after green
  greenUsed: number // greenId already spent, so one crossing per green
  perpPush: number // player shove perpendicular to travel, decays
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
  private time = 0
  private signalT = 0
  private walk = true
  private greenId = 0

  constructor(
    count: number,
    private readonly streets: Streets,
  ) {
    this.mesh = new THREE.InstancedMesh(
      humanoidGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 }),
      count,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false

    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      color.setHex(JACKETS[i % JACKETS.length]!).multiplyScalar(0.85 + Math.random() * 0.3)
      this.mesh.setColorAt(i, color)
    }

    this.umbrellas = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.62, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x8ea6d8, roughness: 0.5, metalness: 0.1 }),
      count,
    )
    this.umbrellas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.umbrellas.frustumCulled = false
    this.umbrellas.visible = false

    for (let i = 0; i < count; i++) this.npcs.push(this.spawn(true))
    this.writeMatrices()
  }

  /** Current pedestrian phase for the signal visual: walk=green, t=seconds into phase. */
  get signal(): { walk: boolean; t: number } {
    return { walk: this.walk, t: this.signalT }
  }

  setRaining(raining: boolean): void {
    this.raining = raining
    this.umbrellas.visible = raining
  }

  /**
   * The escape beat: a dense mass pours down the lanes nearest `centre`, blocking
   * whatever route the player was taking. Pulls crossers onto lanes too.
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

      n.mode = 'lane'
      n.walking = false
      n.lane = lane
      n.surge = true
      n.pause = 0
      n.baseSpeed = 3.4 + Math.random() * 2.2
      n.offset = (Math.random() * 2 - 1) * LANE_JITTER
      n.along = THREE.MathUtils.clamp(anchor + (Math.random() * 2 - 1) * 26, lane.min, lane.max)
      n.dir = Math.random() < 0.5 ? 1 : -1
      converted++
    }
  }

  update(dt: number, player: THREE.Vector3, density: number): void {
    const speedScale = 1 - 0.35 * density
    this.time += dt
    const t = this.time

    // Signal cycle drives the whole scramble.
    this.signalT += dt
    if (this.walk && this.signalT > CROSS_WALK) {
      this.walk = false
      this.signalT = 0
    } else if (!this.walk && this.signalT > CROSS_WAIT) {
      this.walk = true
      this.signalT = 0
      this.greenId++
    }

    for (const n of this.npcs) {
      if (n.mode === 'cross') this.updateCrosser(n, dt, t, speedScale)
      else this.updateLaner(n, dt, t, speedScale)

      // Step aside rather than walk through the courier.
      const dx = n.px - player.x
      const dz = n.pz - player.z
      const distSq = dx * dx + dz * dz
      if (distSq < PUSH_RADIUS * PUSH_RADIUS && distSq > 1e-4) {
        const dist = Math.sqrt(distSq)
        const push = ((PUSH_RADIUS - dist) / dist) * 0.6
        if (n.mode === 'lane') {
          const offsetPush = n.lane.axis === 'x' ? dz : dx
          n.along += (n.lane.axis === 'x' ? dx : dz) * push
          n.offset = THREE.MathUtils.clamp(n.offset + offsetPush * push, -LANE_JITTER, LANE_JITTER)
        } else {
          // Shove perpendicular to the crossing direction.
          n.perpPush = THREE.MathUtils.clamp(n.perpPush + (dx + dz) * push * 0.5, -2.4, 2.4)
        }
        n.px += dx * push * 0.4
        n.pz += dz * push * 0.4
      }
    }

    this.writeMatrices()
  }

  private updateLaner(n: Npc, dt: number, t: number, speedScale: number): void {
    if (n.pause > 0) {
      n.pause -= dt
    } else {
      if (!n.surge && Math.random() < PAUSE_RATE * dt) {
        n.pause = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN)
      }
      const wobble = 1 + SPEED_WOBBLE * Math.sin(t * n.weaveFreq * 3 + n.phase)
      n.along += n.dir * n.baseSpeed * wobble * speedScale * dt
    }
    if (n.along > n.lane.max || n.along < n.lane.min) {
      Object.assign(n, this.spawn())
      return
    }

    const render = THREE.MathUtils.clamp(
      n.offset + n.weaveAmp * Math.sin(t * n.weaveFreq + n.phase),
      -LANE_BOUND,
      LANE_BOUND,
    )
    if (n.lane.axis === 'x') {
      n.px = n.along
      n.pz = n.lane.lane + render
      n.yaw = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2
    } else {
      n.px = n.lane.lane + render
      n.pz = n.along
      n.yaw = n.dir > 0 ? 0 : Math.PI
    }
  }

  private updateCrosser(n: Npc, dt: number, t: number, speedScale: number): void {
    // Standing at the curb — start across when the light turns green (once per green).
    if (!n.walking) {
      if (this.walk && n.greenUsed !== this.greenId) {
        n.greenUsed = this.greenId
        this.assignCrossing(n)
        n.walking = true
        n.crossDelay = Math.random() * CROSS_STAGGER
      }
    } else if (n.crossDelay > 0) {
      n.crossDelay -= dt
    } else {
      const wobble = 1 + SPEED_WOBBLE * Math.sin(t * n.weaveFreq * 3 + n.phase)
      n.p += (n.baseSpeed * wobble * speedScale * dt) / n.crossLen
      if (n.p >= 1) {
        n.p = 1
        n.walking = false // arrived at the far curb; wait for the next green
        n.fromX = n.toX
        n.fromZ = n.toZ
        n.fromSide = sideOf(n.toX, n.toZ)
      }
    }

    n.perpPush *= Math.max(0, 1 - dt * 3)

    const ux = (n.toX - n.fromX) / n.crossLen
    const uz = (n.toZ - n.fromZ) / n.crossLen
    const along = n.p * n.crossLen
    const lateral = n.weaveAmp * 0.5 * Math.sin(t * n.weaveFreq + n.phase) + n.perpPush
    n.px = n.fromX + ux * along + -uz * lateral
    n.pz = n.fromZ + uz * along + ux * lateral
    if (n.walking && n.crossDelay <= 0) n.yaw = Math.atan2(ux, uz)
  }

  /** Pick a target on a different edge of the square → straight or diagonal crossing. */
  private assignCrossing(n: Npc): void {
    const toSide = (n.fromSide + 1 + Math.floor(Math.random() * 3)) % 4
    const to = pointOnSide(toSide)
    n.toX = to.x
    n.toZ = to.z
    n.crossLen = Math.max(1, Math.hypot(to.x - n.fromX, to.z - n.fromZ))
    n.p = 0
  }

  /** 0..1 resistance the player feels, from how many NPCs are pressed around them. */
  dragAt(player: THREE.Vector3): number {
    let near = 0
    for (const n of this.npcs) {
      const dx = n.px - player.x
      const dz = n.pz - player.z
      if (dx * dx + dz * dz < DRAG_RADIUS * DRAG_RADIUS) near++
    }
    return Math.min(1, near / 26)
  }

  private writeMatrices(): void {
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]!
      this.quat.setFromAxisAngle(UP, n.yaw)
      this.scale.set(n.scale, n.scaleY, n.scale)
      this.pos.set(n.px, 0, n.pz)
      this.matrix.compose(this.pos, this.quat, this.scale)
      this.mesh.setMatrixAt(i, this.matrix)

      if (this.raining) {
        this.pos.set(n.px, 1.95 * n.scaleY, n.pz) // umbrella tracks the scaled head height
        this.matrix.compose(this.pos, this.quat, this.scale)
        this.umbrellas.setMatrixAt(i, this.matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.raining) this.umbrellas.instanceMatrix.needsUpdate = true
  }

  private spawn(anywhere = false): Npc {
    const scale = 0.9 + Math.random() * 0.22 // build 0.9–1.12
    const base: Npc = {
      mode: 'lane',
      px: 0,
      pz: 0,
      yaw: 0,
      scale,
      scaleY: scale * (0.96 + Math.random() * 0.09),
      weaveAmp: WEAVE_AMP * (0.6 + Math.random() * 0.6),
      weaveFreq: 0.4 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      // Skewed so most dawdle and a thin tail hurries — a Shibuya crowd, not a conveyor.
      baseSpeed: 0.9 + Math.pow(Math.random(), 1.8) * 3.2,
      surge: false,
      lane: this.streets.lanes[0]!,
      along: 0,
      offset: 0,
      dir: 1,
      pause: 0,
      fromX: 0,
      fromZ: 0,
      fromSide: 0,
      toX: 0,
      toZ: 0,
      crossLen: 1,
      p: 0,
      walking: false,
      crossDelay: 0,
      greenUsed: -1,
      perpPush: 0,
    }

    if (Math.random() < CROSSER_FRACTION) {
      base.mode = 'cross'
      const from = pointOnSide(Math.floor(Math.random() * 4))
      base.fromX = from.x
      base.fromZ = from.z
      base.fromSide = from.side
      base.px = from.x
      base.pz = from.z
      // Seed mid-scramble so frame 0 already shows a crossing, not a full curb queue.
      if (anywhere && Math.random() < 0.6) {
        base.greenUsed = this.greenId
        this.assignCrossing(base)
        base.walking = true
        base.p = Math.random()
      }
      return base
    }

    const lane = this.streets.lanes[Math.floor(Math.random() * this.streets.lanes.length)]!
    const dir = Math.random() < 0.5 ? 1 : -1
    base.lane = lane
    base.dir = dir
    base.offset = (Math.random() * 2 - 1) * LANE_JITTER
    base.along = anywhere
      ? lane.min + Math.random() * (lane.max - lane.min)
      : dir > 0
        ? lane.min + Math.random() * 6
        : lane.max - Math.random() * 6
    base.px = lane.axis === 'x' ? base.along : lane.lane
    base.pz = lane.axis === 'x' ? lane.lane : base.along
    return base
  }
}

/** A point on one edge of the crossing square; side 0=N 1=E 2=S 3=W. */
function pointOnSide(side: number): { x: number; z: number; side: number } {
  const t = (Math.random() * 2 - 1) * SQUARE
  switch (side) {
    case 0:
      return { x: t, z: -SQUARE, side }
    case 1:
      return { x: SQUARE, z: t, side }
    case 2:
      return { x: t, z: SQUARE, side }
    default:
      return { x: -SQUARE, z: t, side }
  }
}

function sideOf(x: number, z: number): number {
  if (z <= -SQUARE + 0.5) return 0
  if (x >= SQUARE - 0.5) return 1
  if (z >= SQUARE - 0.5) return 2
  return 3
}

function laneDistance(lane: Lane, point: THREE.Vector3): number {
  return Math.abs(lane.lane - (lane.axis === 'x' ? point.z : point.x))
}
