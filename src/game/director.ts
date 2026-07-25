import * as THREE from 'three'
import type { DirectorEvent } from '../data/feeds'
import { showNarration } from '../ui/hud'
import type { Crowd } from './crowd'
import type { Encounters } from './encounters'
import type { Player } from './player'
import type { Run } from './run'

// ponytail: fixed station-side coordinate; a derived station anchor if the map ever moves it.
const STATION = new THREE.Vector3(18, 0, 40)
const ORIGIN = new THREE.Vector3(0, 0, 0)

/** Turns a validated DirectorEvent into an actual street beat, only while a run is live. */
export function createDirector(deps: {
  crowd: Crowd
  encounters: Encounters
  run: Run
  player: Player
}) {
  const { crowd, encounters, run, player } = deps

  return {
    dispatch(ev: DirectorEvent): void {
      if (run.state === 'running') {
        const centre =
          ev.where === 'drop' ? run.dropPoint : ev.where === 'station' ? STATION : ORIGIN
        switch (ev.event) {
          case 'surge':
            crowd.surge(centre.clone().lerp(player.position, 0.4), 300 + ev.intensity * 400)
            break
          case 'pickpocket':
            encounters.spawnPickpocket(player.position)
            break
          case 'checkpoint':
            encounters.spawnCop(centre, ev.line)
            break
          case 'calm':
            break
        }
      }
      if (ev.line) showNarration(ev.line)
    },
  }
}
