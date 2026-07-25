import GUI from 'lil-gui'
import * as THREE from 'three'
import { look } from '../city/look'
import type { Stage } from '../render/stage'

/**
 * Jun's art panel. Everything bound here applies live; geometry-driven values
 * (building heights, sign density) need a reload, so they are not bound.
 * Tune, then commit the numbers into src/city/look.ts.
 */
export function createArtPanel(stage: Stage): GUI {
  const gui = new GUI({ title: 'Look — Jun' })
  gui.close()

  const fog = stage.scene.fog as THREE.FogExp2

  const atmosphere = gui.addFolder('Atmosphere')
  atmosphere.addColor(look, 'fogColor').onChange((v: number) => fog.color.set(v))
  atmosphere.add(look, 'fogDensity', 0, 0.05, 0.0005).onChange((v: number) => (fog.density = v))
  atmosphere.add(look, 'exposure', 0.2, 3, 0.01).onChange((v: number) => (stage.renderer.toneMappingExposure = v))

  const bloom = gui.addFolder('Bloom')
  bloom.add(look, 'bloomIntensity', 0, 5, 0.05).onChange((v: number) => (stage.bloom.intensity = v))
  bloom
    .add(look, 'bloomThreshold', 0, 1, 0.01)
    .onChange((v: number) => (stage.bloom.luminanceMaterial.threshold = v))
  bloom
    .add(look, 'bloomSmoothing', 0, 1, 0.01)
    .onChange((v: number) => (stage.bloom.luminanceMaterial.smoothing = v))

  const env = gui.addFolder('Environment')
  env.add(stage.scene, 'environmentIntensity', 0, 1, 0.01).name('reflection strength')

  gui.add({ copy: () => copyLook() }, 'copy').name('Copy values to clipboard')

  return gui
}

function copyLook(): void {
  const json = JSON.stringify(look, null, 2)
  navigator.clipboard?.writeText(json).then(
    () => console.log('[look] copied — paste the changed values into src/city/look.ts'),
    () => console.log(json),
  )
}
