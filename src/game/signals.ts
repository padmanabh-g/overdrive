import * as THREE from 'three'
import { CROSS_WALK } from './crowd'

// Pedestrian signals ringing the scramble so the player can read the green/red cycle.
// SQUARE = 22 in crowd.ts; curb midpoints sit at the 4 edge centers, each facing inward.
const CURB = 22
const FLASH_LEAD = 2.5 // seconds of blinking green before it turns red (JP "about to change")
const FLASH_HZ = 4

const RED_LIT = new THREE.Color(0xff2f3a)
const RED_DARK = new THREE.Color(0x120406)
const GREEN_LIT = new THREE.Color(0x22ff6a)
const GREEN_DARK = new THREE.Color(0x04120a)

type Lamp = THREE.MeshBasicMaterial

export class TrafficSignals {
  readonly group = new THREE.Group()
  private readonly reds: Lamp[] = []
  private readonly greens: Lamp[] = []

  constructor() {
    this.group.name = 'pedestrian signals'
    // Edge centers + inward facing (yaw so the fixture's +Z face points at the crossing origin).
    const posts: Array<[number, number, number]> = [
      [0, -CURB, 0], // N curb, faces +Z
      [0, CURB, Math.PI], // S curb, faces -Z
      [-CURB, 0, Math.PI / 2], // W curb, faces +X
      [CURB, 0, -Math.PI / 2], // E curb, faces -X
    ]
    for (const [x, z, yaw] of posts) this.group.add(this.fixture(x, z, yaw))
  }

  private fixture(x: number, z: number, yaw: number): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = yaw

    // ponytail: one shared dark housing/pole material, lamps get their own so they can blink.
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.6, metalness: 0.4 })

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4, 8), dark)
    pole.position.y = 2
    g.add(pole)

    const housing = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.5), dark)
    housing.position.y = 4.4
    g.add(housing)

    const red = new THREE.MeshBasicMaterial({ color: RED_DARK, toneMapped: false })
    const green = new THREE.MeshBasicMaterial({ color: GREEN_DARK, toneMapped: false })
    const lens = new THREE.CircleGeometry(0.34, 16)
    const redLamp = new THREE.Mesh(lens, red)
    redLamp.position.set(0, 4.8, 0.26) // top = stand
    const greenLamp = new THREE.Mesh(lens, green)
    greenLamp.position.set(0, 4.0, 0.26) // bottom = walk
    g.add(redLamp, greenLamp)

    this.reds.push(red)
    this.greens.push(green)
    return g
  }

  update(signal: { walk: boolean; t: number }): void {
    // Blink green in the final FLASH_LEAD seconds of the walk phase.
    const flashing = signal.walk && signal.t > CROSS_WALK - FLASH_LEAD
    const greenOn = signal.walk && (!flashing || Math.floor(signal.t * FLASH_HZ) % 2 === 0)
    const red = signal.walk ? RED_DARK : RED_LIT // red only during the wait phase
    const green = greenOn ? GREEN_LIT : GREEN_DARK
    for (const m of this.reds) m.color.copy(red)
    for (const m of this.greens) m.color.copy(green)
  }
}
