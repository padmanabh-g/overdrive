import GUI from "lil-gui";

import { cityLook, type CityLook } from "../city/look";
import type { ShibuyaCity } from "../city";
import type { CityLighting, RenderPipeline } from "../render";

export type ArtGuiTargets = {
  city?: ShibuyaCity;
  lighting?: CityLighting;
  pipeline?: RenderPipeline;
};

export function bindArtGui(look: CityLook = cityLook, targets: ArtGuiTargets = {}): GUI {
  const gui = new GUI({ title: "Jun look" });

  const apply = () => {
    targets.city?.applyLook(look);
    targets.lighting?.applyLook(look);
    targets.pipeline?.applyLook(look);
  };

  const fog = gui.addFolder("Fog");
  fog.addColor(look.fog, "color").onChange(apply);
  fog.add(look.fog, "density", 0, 0.06, 0.001).onChange(apply);

  const tone = gui.addFolder("Tone");
  tone.add(look.toneMapping, "exposure", 0.5, 2.2, 0.01).onChange(apply);

  const bloom = gui.addFolder("Bloom");
  bloom.add(look.bloom, "intensity", 0, 3, 0.01).onChange(apply);
  bloom.add(look.bloom, "luminanceThreshold", 0, 2, 0.01).onChange(apply);
  bloom.add(look.bloom, "luminanceSmoothing", 0, 1, 0.01).onChange(apply);

  const ssao = gui.addFolder("SSAO");
  ssao.add(look.ssao, "intensity", 0, 2, 0.01).onChange(apply);
  ssao.add(look.ssao, "radius", 0, 24, 0.1).onChange(apply);
  ssao.add(look.ssao, "resolutionScale", 0.25, 1, 0.01).onChange(apply);

  const lighting = gui.addFolder("Lighting");
  lighting.addColor(look.lighting, "ambientColor").onChange(apply);
  lighting.add(look.lighting, "ambientIntensity", 0, 2, 0.01).onChange(apply);
  lighting.addColor(look.lighting, "hemiSkyColor").onChange(apply);
  lighting.addColor(look.lighting, "hemiGroundColor").onChange(apply);
  lighting.add(look.lighting, "hemiIntensity", 0, 2, 0.01).onChange(apply);
  lighting.addColor(look.lighting, "keyColor").onChange(apply);
  lighting.add(look.lighting, "keyIntensity", 0, 4, 0.01).onChange(apply);

  const surfaces = gui.addFolder("Wet surfaces");
  surfaces.addColor(look.ground, "asphaltColor").onChange(apply);
  surfaces.addColor(look.ground, "roadColor").onChange(apply);
  surfaces.add(look.ground, "roughness", 0.02, 0.8, 0.01).onChange(apply);
  surfaces.add(look.ground, "metalness", 0, 1, 0.01).onChange(apply);
  surfaces.add(look.ground, "reflectionOpacity", 0, 0.75, 0.01).onChange(apply);

  const windows = gui.addFolder("Windows");
  windows.addColor(look.buildings, "baseColor").onChange(apply);
  windows.addColor(look.buildings, "windowEmissive").onChange(apply);
  windows.add(look.buildings, "windowIntensity", 0, 4, 0.01).onChange(apply);

  const rain = gui.addFolder("Rain");
  rain.add(look.rain, "enabled").onChange(apply);
  rain.addColor(look.rain, "color").onChange(apply);
  rain.add(look.rain, "opacity", 0, 0.9, 0.01).onChange(apply);
  rain.add(look.rain, "speed", 0, 60, 0.5).onChange(apply);

  apply();
  return gui;
}
