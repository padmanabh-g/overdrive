import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect } from 'postprocessing'
import { look } from '../city/look'

export type Stage = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  composer: EffectComposer
  bloom: BloomEffect
  render: () => void
}

export function createStage(): Stage {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = look.exposure
  document.body.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(look.fogColor, look.fogDensity)
  scene.background = makeSky()

  // A dim environment map is what makes the wet asphalt actually reflect something.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.22
  pmrem.dispose()

  scene.add(new THREE.AmbientLight(look.ambientColor, look.ambientIntensity))

  const moon = new THREE.DirectionalLight(look.moonColor, look.moonIntensity)
  moon.position.set(-60, 120, 40)
  scene.add(moon)

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900)
  camera.position.set(0, 6, 14)

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))

  const bloom = new BloomEffect({
    intensity: look.bloomIntensity,
    luminanceThreshold: look.bloomThreshold,
    luminanceSmoothing: look.bloomSmoothing,
    mipmapBlur: true,
    radius: look.bloomRadius,
  })
  composer.addPass(new EffectPass(camera, bloom, new SMAAEffect()))

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    composer.setSize(innerWidth, innerHeight)
  })

  return { renderer, scene, camera, composer, bloom, render: () => composer.render() }
}

/** Vertical gradient sky, generated once into a canvas. Cheaper than a shader, looks the same. */
function makeSky(): THREE.Texture {
  const el = document.createElement('canvas')
  el.width = 2
  el.height = 256
  const ctx = el.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, `#${new THREE.Color(look.skyTop).getHexString()}`)
  grad.addColorStop(1, `#${new THREE.Color(look.skyBottom).getHexString()}`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 2, 256)

  const tex = new THREE.CanvasTexture(el)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.mapping = THREE.EquirectangularReflectionMapping
  return tex
}
