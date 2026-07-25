import * as THREE from 'three'
import { humanoidGeometry } from './humanoid'

const RADIUS = 0.85
const WALK = 9.5
const SPRINT = 16.5
const ACCEL = 44
const CAM_DIST = 7.6
const CAM_HEIGHT = 3.4

export class Player {
  readonly position = new THREE.Vector3(0, 0, 26)
  readonly mesh: THREE.Group
  yaw = 0
  private pitch = -0.05
  private readonly velocity = new THREE.Vector3()
  private readonly keys = new Set<string>()
  private readonly camPos = new THREE.Vector3()
  private readonly camTarget = new THREE.Vector3()

  constructor() {
    this.mesh = new THREE.Group()

    const body = new THREE.Mesh(
      humanoidGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.55, metalness: 0.2 }),
    )
    this.mesh.add(body)

    // The parcel doubles as the player silhouette — a glowing box you can always find.
    const parcel = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff4f8d, toneMapped: false }),
    )
    parcel.position.set(0, 1.4, -0.28)
    this.mesh.add(parcel)

    addEventListener('keydown', (e) => this.keys.add(e.code))
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === null) return
      this.yaw -= e.movementX * 0.0022
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0018, -0.55, 0.5)
    })
  }

  get sprinting(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
  }

  /** `drag` is 0..1 crowd resistance — dense crowds make the courier wade. */
  update(dt: number, colliders: THREE.Box3[], bounds: { x: number; z: number }, drag: number): void {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(forward.z, 0, -forward.x)

    const wish = new THREE.Vector3()
    if (this.keys.has('KeyW')) wish.add(forward)
    if (this.keys.has('KeyS')) wish.sub(forward)
    if (this.keys.has('KeyD')) wish.add(right)
    if (this.keys.has('KeyA')) wish.sub(right)

    const speed = (this.sprinting ? SPRINT : WALK) * (1 - 0.72 * drag)
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed)

    this.velocity.lerp(wish, Math.min(1, ACCEL * dt * 0.05))
    this.position.addScaledVector(this.velocity, dt)

    this.resolveCollisions(colliders)

    this.position.x = THREE.MathUtils.clamp(this.position.x, -bounds.x, bounds.x)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -bounds.z, bounds.z)

    this.mesh.position.copy(this.position)
    if (this.velocity.lengthSq() > 0.4) {
      this.mesh.rotation.y = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
  }

  updateCamera(camera: THREE.PerspectiveCamera, dt: number): void {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))

    this.camPos
      .copy(this.position)
      .addScaledVector(forward, -CAM_DIST)
      .setY(this.position.y + CAM_HEIGHT - this.pitch * 9)

    this.camTarget.copy(this.position).setY(this.position.y + 1.7 + this.pitch * 4)

    camera.position.lerp(this.camPos, Math.min(1, dt * 9))
    camera.lookAt(this.camTarget)
  }

  private resolveCollisions(colliders: THREE.Box3[]): void {
    for (const b of colliders) {
      const cx = THREE.MathUtils.clamp(this.position.x, b.min.x, b.max.x)
      const cz = THREE.MathUtils.clamp(this.position.z, b.min.z, b.max.z)
      const dx = this.position.x - cx
      const dz = this.position.z - cz
      const distSq = dx * dx + dz * dz

      if (distSq > RADIUS * RADIUS) continue

      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq)
        const push = (RADIUS - dist) / dist
        this.position.x += dx * push
        this.position.z += dz * push
      } else {
        // Centre penetration: eject along the shallowest axis.
        const toLeft = this.position.x - b.min.x
        const toRight = b.max.x - this.position.x
        const toBack = this.position.z - b.min.z
        const toFront = b.max.z - this.position.z
        const min = Math.min(toLeft, toRight, toBack, toFront)
        if (min === toLeft) this.position.x = b.min.x - RADIUS
        else if (min === toRight) this.position.x = b.max.x + RADIUS
        else if (min === toBack) this.position.z = b.min.z - RADIUS
        else this.position.z = b.max.z + RADIUS
      }
    }
  }
}
