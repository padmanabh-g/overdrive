import * as THREE from 'three'

const RUN_SECONDS = 150
const SURGE_AT = 100
const ARRIVE_RADIUS = 3.2

export type RunEvent = 'surge' | 'won' | 'lost'
export type RunState = 'idle' | 'running' | 'won' | 'lost'

export class Run {
  readonly marker: THREE.Group
  state: RunState = 'idle'
  timeLeft = RUN_SECONDS
  readonly dropPoint = new THREE.Vector3()
  private surgeFired = false

  constructor(private readonly streetLines: number[]) {
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
    this.pickDropPoint(playerPos)
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
    if (dx * dx + dz * dz < ARRIVE_RADIUS * ARRIVE_RADIUS) {
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

  get distance(): number {
    return this.dropPoint.length()
  }

  distanceFrom(pos: THREE.Vector3): number {
    return Math.hypot(pos.x - this.dropPoint.x, pos.z - this.dropPoint.z)
  }

  /** Far enough that the run is a real trip, and always on a street intersection. */
  private pickDropPoint(from: THREE.Vector3): void {
    let best = new THREE.Vector3()
    let bestDist = -1

    for (let attempt = 0; attempt < 40; attempt++) {
      const x = this.streetLines[Math.floor(Math.random() * this.streetLines.length)] ?? 0
      const z = this.streetLines[Math.floor(Math.random() * this.streetLines.length)] ?? 0
      const dist = Math.hypot(x - from.x, z - from.z)
      if (dist > bestDist) {
        bestDist = dist
        best = new THREE.Vector3(x, 0, z)
      }
      if (bestDist > 150) break
    }

    this.dropPoint.copy(best)
    this.marker.position.copy(best)
  }
}
