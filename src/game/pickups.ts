import * as THREE from 'three'
import { audio } from '../audio/audio'
import type { Player } from './player'

const PICK_RADIUS = 1.7
const RESPAWN = 8

export type Kind = 'onigiri' | 'pocari' | 'beer'

const COLOR: Record<Kind, number> = {
  onigiri: 0xf4f0e6,
  pocari: 0x3aa0ff,
  beer: 0xe0a020,
}

// Grabbing anything scores — the buffs more than the poison.
const POINTS: Record<Kind, number> = { onigiri: 50, pocari: 50, beer: 25 }

// Halo colour: cool/green = safe buff, hot red = beer poison. Reads as a focus light on the ground.
const HALO: Record<Kind, number> = { onigiri: 0x9dffc4, pocari: 0x5cb8ff, beer: 0xff4d33 }

export type PickupMarker = { x: number; z: number; kind: Kind; active: boolean }

type Pickup = {
  kind: Kind
  mesh: THREE.Mesh
  glow: THREE.Object3D // halo sphere + ground pool, hidden while collected
  home: number // base bob height
  respawn: number // >0 while collected
}

/** Konbini snacks on the open crossing ground: onigiri/Pocari buff, beer poisons. */
export class Pickups {
  readonly group = new THREE.Group()
  private readonly picks: Pickup[] = []

  constructor() {
    // Just inside the open square edges, on foot-traffic ground — not under a konbini.
    const spots: Array<{ kind: Kind; x: number; z: number }> = [
      { kind: 'onigiri', x: -16, z: -18 },
      { kind: 'pocari', x: 16, z: -18 },
      { kind: 'onigiri', x: 16, z: 18 },
      { kind: 'beer', x: -16, z: 18 },
    ]

    for (const s of spots) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        new THREE.MeshBasicMaterial({ color: COLOR[s.kind], toneMapped: false }),
      )
      const home = 1.1
      mesh.position.set(s.x, home, s.z)
      mesh.name = `konbini pickup ${s.kind}`
      this.group.add(mesh)

      const glow = new THREE.Group()
      glow.position.set(s.x, 0, s.z)
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.05, 16, 12),
        new THREE.MeshBasicMaterial({
          color: HALO[s.kind],
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      )
      halo.position.y = home
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(2.1, 32),
        new THREE.MeshBasicMaterial({
          color: HALO[s.kind],
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      )
      pool.rotation.x = -Math.PI / 2
      pool.position.y = 0.06
      glow.add(halo, pool)
      this.group.add(glow)

      this.picks.push({ kind: s.kind, mesh, glow, home, respawn: 0 })
    }
  }

  /** Returns points scored this frame (0 unless a pickup was grabbed). */
  update(dt: number, player: Player): number {
    const t = performance.now() * 0.001
    let scored = 0
    for (const p of this.picks) {
      if (p.respawn > 0) {
        p.respawn -= dt
        if (p.respawn <= 0) {
          p.mesh.visible = true
          p.glow.visible = true
        }
        continue
      }

      p.mesh.rotation.y += dt * 1.6
      p.mesh.position.y = p.home + Math.sin(t * 2 + p.mesh.position.x) * 0.12
      // Breathe the halo so it reads as an active light, not a decal.
      p.glow.scale.setScalar(1 + Math.sin(t * 3 + p.mesh.position.x) * 0.08)

      const dx = p.mesh.position.x - player.position.x
      const dz = p.mesh.position.z - player.position.z
      if (dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS) {
        if (p.kind === 'beer') {
          player.buff(0.6, 5)
          audio.sfx('beer')
        } else {
          player.buff(1.35, 6)
          audio.sfx('pickup')
        }
        scored += POINTS[p.kind]
        p.mesh.visible = false
        p.glow.visible = false
        p.respawn = RESPAWN
      }
    }
    return scored
  }

  /** World positions + kind for the minimap; `active` false while collected. */
  markers(): PickupMarker[] {
    return this.picks.map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z, kind: p.kind, active: p.respawn <= 0 }))
  }
}
