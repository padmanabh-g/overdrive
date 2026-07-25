import * as THREE from 'three'
import { buildCity } from './city/city'
import { feeds, isRaining, type Rail, type Weather } from './data/feeds'
import { Crowd, makeRain } from './game/crowd'
import { Player } from './game/player'
import { Run } from './game/run'
import { createStage } from './render/stage'
import { createArtPanel } from './ui/gui'
import { showNarration, updateConditions, updateObjective } from './ui/hud'

const CROWD_SIZE = 1400
const FEED_INTERVAL_MS = 30_000

const stage = createStage()
const city = buildCity()
stage.scene.add(city.group)

const player = new Player()
stage.scene.add(player.mesh)

const crowd = new Crowd(CROWD_SIZE, city.streetLines, city.extent)
stage.scene.add(crowd.mesh, crowd.umbrellas)

const run = new Run(city.streetLines)
stage.scene.add(run.marker)

const rain = makeRain()
stage.scene.add(rain.points)

createArtPanel(stage)

let weather: Weather = { source: 'pending', live: false, tempC: 24, precipMm: 0, windKph: 8, weatherCode: 0 }
let rail: Rail = { source: 'pending', live: false, lines: [] }
let density = 0.5
let drag = 0

async function pollFeeds(): Promise<void> {
  const [w, r, probe] = await Promise.all([feeds.weather(), feeds.rail(), feeds.probeDensity()])

  const wasRaining = isRaining(weather)
  weather = w
  rail = r
  density = probe.density

  const nowRaining = isRaining(weather)
  crowd.setRaining(nowRaining)
  rain.points.visible = nowRaining

  if (nowRaining !== wasRaining) {
    const { line } = await feeds.narrate(nowRaining ? 'rain' : 'clear')
    showNarration(line)
  }
}

void pollFeeds()
setInterval(() => void pollFeeds(), FEED_INTERVAL_MS)

const startOverlay = document.getElementById('start')!

function beginRun(): void {
  startOverlay.classList.add('hide')
  stage.renderer.domElement.requestPointerLock()
  run.start(player.position)
}

startOverlay.addEventListener('click', beginRun)
stage.renderer.domElement.addEventListener('click', () => {
  if (run.state === 'running' && document.pointerLockElement === null) {
    stage.renderer.domElement.requestPointerLock()
  }
})

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && (run.state === 'lost' || run.state === 'won')) beginRun()
})

const clock = new THREE.Clock()
let hudAccumulator = 0

function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05)

  drag = crowd.dragAt(player.position)

  player.update(dt, city.colliders, city.extent, drag)
  player.updateCamera(stage.camera, dt)
  crowd.update(dt, player.position, density)
  rain.update(dt, player.position)

  const event = run.update(dt, player.position)
  if (event === 'surge') {
    crowd.surge(run.dropPoint.clone().lerp(player.position, 0.5), 520)
    void feeds.narrate('surge').then(({ line }) => showNarration(line))
  } else if (event === 'won') {
    showNarration('配達完了 — Parcel delivered. Press R to run again.')
    document.exitPointerLock()
  } else if (event === 'lost') {
    showNarration('時間切れ — The city won this one. Press R to try again.')
    document.exitPointerLock()
  }

  hudAccumulator += dt
  if (hudAccumulator > 0.1) {
    hudAccumulator = 0
    updateObjective(run, run.distanceFrom(player.position), drag)
    updateConditions(weather, rail, density, rain.points.visible)
  }

  stage.render()
  requestAnimationFrame(frame)
}

frame()
