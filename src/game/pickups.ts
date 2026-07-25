import * as THREE from 'three'
import { audio } from '../audio/audio'
import type { Player } from './player'

const PICK_RADIUS = 1.7
const RESPAWN = 8

type Kind = 'onigiri' | 'pocari' | 'beer'

const COLOR: Record<Kind, number> = {
  onigiri: 0xf4f0e6,
  pocari: 0x3aa0ff,
  beer: 0xe0a020,
}

type Pickup = {
  kind: Kind
  mesh: THREE.Mesh
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
      this.picks.push({ kind: s.kind, mesh, home, respawn: 0 })
    }
  }

  update(dt: number, player: Player): void {
    const t = performance.now() * 0.001
    for (const p of this.picks) {
      if (p.respawn > 0) {
        p.respawn -= dt
        if (p.respawn <= 0) p.mesh.visible = true
        continue
      }

      p.mesh.rotation.y += dt * 1.6
      p.mesh.position.y = p.home + Math.sin(t * 2 + p.mesh.position.x) * 0.12

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
        p.mesh.visible = false
        p.respawn = RESPAWN
      }
    }
  }
}
