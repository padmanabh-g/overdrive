import * as THREE from 'three'
import { farthestDrop, type Streets } from './streets'

const RUN_SECONDS = 150
const SURGE_AT = 100
const ARRIVE_RADIUS = 3.2

export type RunEvent = 'surge' | 'delivered' | 'won' | 'lost'
export type RunState = 'idle' | 'running' | 'won' | 'lost'

export class Run {
  readonly marker: THREE.Group
  state: RunState = 'idle'
  timeLeft = RUN_SECONDS
  parcelStolen = false
  readonly total = 3
  delivered = 0
  score = 0
  readonly dropPoint = new THREE.Vector3()
  private surgeFired = false

  constructor(private readonly streets: Streets) {
    this.marker = new THREE.Group()

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x54ffc8,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    beam.position.y = 20
    this.marker.add(beam)

    const pad = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x54ffc8, toneMapped: false, side: THREE.DoubleSide }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.08
    this.marker.add(pad)

    this.pickDropPoint(new THREE.Vector3())
  }

  start(playerPos: THREE.Vector3): void {
    this.state = 'running'
    this.timeLeft = RUN_SECONDS
    this.surgeFired = false
    this.parcelStolen = false
    this.delivered = 0
    this.score = 0
    this.pickDropPoint(playerPos)
  }

  addScore(points: number): void {
    this.score += points
  }

  /** Encounters bleed time off the clock; the lost-path fires next frame if it hits 0. */
  applyTimePenalty(seconds: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - seconds)
  }

  update(dt: number, playerPos: THREE.Vector3): RunEvent | null {
    if (this.state !== 'running') return null

    this.timeLeft -= dt

    const pad = this.marker.children[1]
    if (pad) pad.rotation.z += dt * 0.8

    if (!this.surgeFired && this.timeLeft <= SURGE_AT) {
      this.surgeFired = true
      return 'surge'
    }

    const dx = playerPos.x - this.dropPoint.x
    const dz = playerPos.z - this.dropPoint.z
    if (!this.parcelStolen && dx * dx + dz * dz < ARRIVE_RADIUS * ARRIVE_RADIUS) {
      if (this.delivered < this.total - 1) {
        this.delivered++
        this.timeLeft += 30
        this.pickDropPoint(playerPos)
        return 'delivered'
      }
      this.delivered++
      this.state = 'won'
      return 'won'
    }

    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this.state = 'lost'
      return 'lost'
    }

    return null
  }

  distanceFrom(pos: THREE.Vector3): number {
    return Math.hypot(pos.x - this.dropPoint.x, pos.z - this.dropPoint.z)
  }

  /** Always the far end of a walkable corridor, so the run is a real trip. */
  private pickDropPoint(from: THREE.Vector3): void {
    const { x, z } = farthestDrop(this.streets, from)
    this.dropPoint.set(x, 0, z)
    this.marker.position.copy(this.dropPoint)
  }
}
