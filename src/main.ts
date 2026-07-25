import * as THREE from 'three'
import { createShibuyaCity } from './city'
import { cityLook } from './city/look'
import { createCityLighting, createRenderPipeline } from './render'
import { feeds, isRaining, type Rail, type Weather } from './data/feeds'
import { Crowd } from './game/crowd'
import { Player } from './game/player'
import { Run } from './game/run'
import { deriveStreets } from './game/streets'
import { bindArtGui } from './ui/gui'
import { showNarration, updateConditions, updateObjective } from './ui/hud'

const CROWD_SIZE = 1400
const FEED_INTERVAL_MS = 30_000

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900)
camera.position.set(0, 6, 34)

// Jun's lane: lighting, city art, and the post pipeline all read cityLook.
const lighting = createCityLighting(scene, renderer, cityLook)
const city = createShibuyaCity(scene, {})
const pipeline = createRenderPipeline(renderer, scene, camera, cityLook)
bindArtGui(cityLook, { city, lighting, pipeline })

// Walkable space is derived from the colliders Jun's city produced, not from its constants.
const streets = deriveStreets(city.colliders, cityLook)
const bounds = { x: streets.halfWidth - 4, z: streets.halfDepth - 4 }

const player = new Player()
scene.add(player.mesh)

const crowd = new Crowd(CROWD_SIZE, streets)
scene.add(crowd.mesh, crowd.umbrellas)

const run = new Run(streets)
scene.add(run.marker)

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  pipeline.setSize(innerWidth, innerHeight)
})

let weather: Weather = { source: 'pending', live: false, tempC: 24, precipMm: 0, windKph: 8, weatherCode: 0 }
let rail: Rail = { source: 'pending', live: false, lines: [] }
let density = 0.5
let drag = 0
let raining = false

function setRaining(next: boolean): void {
  raining = next
  crowd.setRaining(next)
  // Jun's city owns the rain particles; gameplay only flips the switch, the same way
  // their own art panel does.
  cityLook.rain.enabled = next
  city.applyLook(cityLook)
}

setRaining(false)

async function pollFeeds(): Promise<void> {
  const [w, r, probe] = await Promise.all([feeds.weather(), feeds.rail(), feeds.probeDensity()])

  weather = w
  rail = r
  density = probe.density

  const nowRaining = isRaining(weather)
  if (nowRaining !== raining) {
    setRaining(nowRaining)
    const { line } = await feeds.narrate(nowRaining ? 'rain' : 'clear', weather)
    showNarration(line)
  }
}

void pollFeeds()
setInterval(() => void pollFeeds(), FEED_INTERVAL_MS)

const startOverlay = document.getElementById('start')!

function beginRun(): void {
  startOverlay.classList.add('hide')
  renderer.domElement.requestPointerLock()
  run.start(player.position)
}

startOverlay.addEventListener('click', beginRun)
renderer.domElement.addEventListener('click', () => {
  if (run.state === 'running' && document.pointerLockElement === null) {
    renderer.domElement.requestPointerLock()
  }
})

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && (run.state === 'lost' || run.state === 'won')) beginRun()
})

const clock = new THREE.Clock()
let elapsed = 0
let hudAccumulator = 0

function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05)
  elapsed += dt

  drag = crowd.dragAt(player.position)

  player.update(dt, city.colliders, bounds, drag)
  player.updateCamera(camera, dt)
  crowd.update(dt, player.position, density)
  city.update(dt, elapsed)

  const event = run.update(dt, player.position)
  if (event === 'surge') {
    crowd.surge(run.dropPoint.clone().lerp(player.position, 0.5), 520)
    void feeds.narrate('surge', weather).then(({ line }) => showNarration(line))
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
    updateConditions(weather, rail, density, raining)
  }

  pipeline.render(dt)
  requestAnimationFrame(frame)
}

frame()
