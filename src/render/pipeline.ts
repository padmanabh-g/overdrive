import { Scene, WebGLRenderer, type Camera } from "three";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  SMAAEffect,
  SSAOEffect,
} from "postprocessing";

import { cityLook, type CityLook } from "../city/look";

export type RenderPipeline = {
  composer: EffectComposer;
  bloom: BloomEffect;
  ssao?: SSAOEffect;
  render: (deltaSeconds: number) => void;
  setSize: (width: number, height: number) => void;
  applyLook: (nextLook?: CityLook) => void;
  dispose: () => void;
};

export function createRenderPipeline(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  look: CityLook = cityLook,
): RenderPipeline {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: look.bloom.intensity,
    luminanceThreshold: look.bloom.luminanceThreshold,
    luminanceSmoothing: look.bloom.luminanceSmoothing,
    mipmapBlur: look.bloom.mipmapBlur,
  });
  const smaa = new SMAAEffect();
  const normalPass = new NormalPass(scene, camera);
  const ssao = look.ssao.enabled
    ? new SSAOEffect(camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        intensity: look.ssao.intensity,
        radius: look.ssao.radius,
        samples: look.ssao.samples,
        resolutionScale: look.ssao.resolutionScale,
      })
    : undefined;

  composer.addPass(renderPass);

  if (ssao) {
    composer.addPass(normalPass);
    composer.addPass(new EffectPass(camera, ssao, bloom, smaa));
  } else {
    composer.addPass(new EffectPass(camera, bloom, smaa));
  }

  return {
    composer,
    bloom,
    ssao,
    render(deltaSeconds) {
      composer.render(deltaSeconds);
    },
    setSize(width, height) {
      composer.setSize(width, height);
    },
    applyLook(nextLook = look) {
      renderer.toneMappingExposure = nextLook.toneMapping.exposure;
      bloom.intensity = nextLook.bloom.intensity;
      bloom.luminanceMaterial.threshold = nextLook.bloom.luminanceThreshold;
      bloom.luminanceMaterial.smoothing = nextLook.bloom.luminanceSmoothing;

      if (ssao) {
        ssao.intensity = nextLook.ssao.intensity;
        ssao.radius = nextLook.ssao.radius;
        ssao.samples = nextLook.ssao.samples;
        ssao.resolution.scale = nextLook.ssao.resolutionScale;
      }
    },
    dispose() {
      composer.dispose();
    },
  };
}
