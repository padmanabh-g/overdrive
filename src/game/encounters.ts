import * as THREE from 'three'
import { audio } from '../audio/audio'
import { showNarration } from '../ui/hud'
import { humanoidGeometry } from './humanoid'
import type { Player } from './player'
import type { Run } from './run'

const CONTACT = 1.4 // thief has to reach you to lift the parcel
const RECOVER = 1.6 // close enough to grab it back barehanded
const CONE = 3 // a punch reaches a bit further, but only ahead of you
const FLEE_TIME = 10 // seconds before the thief escapes with it
const SPAWN_EVERY = 22 // idle gap between pickpocket beats
const APPROACH_SPEED = 8
const FLEE_SPEED = 7 // < SPRINT, so a chasing courier can run them down
const COP_RANGE = 6
const FREEZE_TIME = 3
const COP_COOLDOWN = 12
const PENALTY = 15
const PARCEL_TINT = 0xff4f8d

type PickState = 'idle' | 'approach' | 'flee'
type PickAction = 'steal' | 'recover' | 'escape' | null

/**
 * The pickpocket state machine, kept pure (no THREE/DOM) so the steal→recover→escape
 * transitions read at a glance. `dist` is player↔thief; `inCone` is the punch-angle test.
 */
export function pickpocketAction(
  state: 'approach' | 'flee',
  c: {
    running: boolean
    parcelStolen: boolean
    dist: number
    isPunching: boolean
    inCone: boolean
    fleeElapsed: number
  },
): PickAction {
  if (state === 'approach') {
    return c.running && !c.parcelStolen && c.dist < CONTACT ? 'steal' : null
  }
  if (c.dist < RECOVER || (c.isPunching && c.inCone && c.dist < CONE)) return 'recover'
  if (c.fleeElapsed >= FLEE_TIME) return 'escape'
  return null
}

/** Active street encounters: a parcel-snatching pickpocket and a checkpoint cop. */
export class Encounters {
  readonly group = new THREE.Group()
  private readonly thief: THREE.Mesh
  private readonly cop: THREE.Mesh
  private thiefState: PickState = 'idle'
  private thiefTimer = SPAWN_EVERY
  private fleeElapsed = 0
  private copPlaced = false
  private copLine?: string
  private freezeT = 0
  private copCooldown = 0

  constructor() {
    this.thief = new THREE.Mesh(
      humanoidGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: 0.6, metalness: 0.1 }),
    )
    this.thief.visible = false
    this.group.add(this.thief)

    this.cop = new THREE.Mesh(
      humanoidGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x1b3a6b, roughness: 0.5, metalness: 0.2 }),
    )
    this.cop.visible = false
    this.group.add(this.cop)
  }

  /** Drop a thief a few metres off the courier and send it homing in. No-op if one's active. */
  spawnPickpocket(near: THREE.Vector3): void {
    if (this.thiefState !== 'idle') return
    const a = Math.random() * Math.PI * 2
    this.thief.position.set(near.x + Math.cos(a) * 10, 0, near.z + Math.sin(a) * 10)
    this.resetThiefLook()
    this.thief.visible = true
    this.thiefState = 'approach'
  }

  /** Station the checkpoint cop. `line` overrides the ID-check narration when it fires. */
  spawnCop(at: THREE.Vector3, line?: string): void {
    this.cop.position.set(at.x, 0, at.z)
    this.cop.visible = true
    this.copPlaced = true
    this.copLine = line
  }

  update(dt: number, player: Player, run: Run, onRed: boolean): void {
    if (!this.copPlaced) this.spawnCop(new THREE.Vector3(8, 0, 18))
    this.updateThief(dt, player, run)
    this.updateCop(dt, player, run, onRed)
  }

  private updateThief(dt: number, player: Player, run: Run): void {
    if (this.thiefState === 'idle') {
      if (run.state === 'running') {
        this.thiefTimer -= dt
        if (this.thiefTimer <= 0) this.spawnPickpocket(player.position)
      }
      return
    }

    const dx = player.position.x - this.thief.position.x
    const dz = player.position.z - this.thief.position.z
    const dist = Math.hypot(dx, dz) || 1

    if (this.thiefState === 'approach') {
      this.thief.position.x += (dx / dist) * APPROACH_SPEED * dt
      this.thief.position.z += (dz / dist) * APPROACH_SPEED * dt
      this.thief.rotation.y = Math.atan2(dx, dz)
      const action = pickpocketAction('approach', {
        running: run.state === 'running',
        parcelStolen: run.parcelStolen,
        dist,
        isPunching: false,
        inCone: false,
        fleeElapsed: 0,
      })
      if (action === 'steal') {
        run.parcelStolen = true
        player.setParcelHeld(false)
        audio.sfx('steal')
        showNarration('スリ — Your parcel! Catch the thief.')
        this.thiefState = 'flee'
        this.fleeElapsed = 0
        this.thief.scale.setScalar(1.25)
        ;(this.thief.material as THREE.MeshStandardMaterial).emissive.setHex(PARCEL_TINT)
      }
      return
    }

    // flee: run away, carrying the glowing parcel
    this.fleeElapsed += dt
    this.thief.position.x -= (dx / dist) * FLEE_SPEED * dt
    this.thief.position.z -= (dz / dist) * FLEE_SPEED * dt
    this.thief.rotation.y = Math.atan2(-dx, -dz)

    const action = pickpocketAction('flee', {
      running: run.state === 'running',
      parcelStolen: run.parcelStolen,
      dist,
      isPunching: player.isPunching,
      inCone: this.inForwardCone(player, dx, dz, dist),
      fleeElapsed: this.fleeElapsed,
    })
    if (action === 'recover') {
      run.parcelStolen = false
      player.setParcelHeld(true)
      audio.sfx('recover')
      showNarration('奪還 — Parcel back. Go!')
      this.despawnThief()
    } else if (action === 'escape') {
      run.applyTimePenalty(PENALTY)
      run.parcelStolen = false // returned so the run stays winnable; the −15s is the cost
      player.setParcelHeld(true)
      audio.sfx('lose')
      showNarration('逃走 — Thief gone. −15s.')
      this.despawnThief()
    }
  }

  private updateCop(dt: number, player: Player, run: Run, onRed: boolean): void {
    if (this.freezeT > 0) {
      this.freezeT -= dt
      if (this.freezeT <= 0) {
        player.frozen = false
        this.copCooldown = COP_COOLDOWN
      }
      return
    }
    if (this.copCooldown > 0) {
      this.copCooldown -= dt
      return
    }
    if (run.state !== 'running') return

    const dx = player.position.x - this.cop.position.x
    const dz = player.position.z - this.cop.position.z
    const near = dx * dx + dz * dz < COP_RANGE * COP_RANGE
    if (onRed || (player.sprinting && near)) {
      player.frozen = true
      this.freezeT = FREEZE_TIME
      audio.sfx('cop')
      showNarration(this.copLine ?? '職質 — Police ID check. Hold still.')
    }
  }

  /** Is the thief within a ~60° wedge ahead of the courier's yaw? */
  private inForwardCone(player: Player, dx: number, dz: number, dist: number): boolean {
    const fx = -Math.sin(player.yaw)
    const fz = -Math.cos(player.yaw)
    return (fx * -dx + fz * -dz) / dist > 0.5
  }

  private despawnThief(): void {
    this.thief.visible = false
    this.thiefState = 'idle'
    this.thiefTimer = SPAWN_EVERY
    this.resetThiefLook()
  }

  private resetThiefLook(): void {
    this.thief.scale.setScalar(1)
    ;(this.thief.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
  }
}
