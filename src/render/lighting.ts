import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Scene,
  WebGLRenderer,
} from "three";

import { cityLook, type CityLook } from "../city/look";

export type CityLighting = {
  ambient: AmbientLight;
  hemisphere: HemisphereLight;
  key: DirectionalLight;
  applyLook: (nextLook?: CityLook) => void;
};

export function createCityLighting(scene: Scene, renderer: WebGLRenderer, look: CityLook = cityLook): CityLighting {
  const ambient = new AmbientLight(look.lighting.ambientColor, look.lighting.ambientIntensity);
  ambient.name = "neon city ambient";

  const hemisphere = new HemisphereLight(
    look.lighting.hemiSkyColor,
    look.lighting.hemiGroundColor,
    look.lighting.hemiIntensity,
  );
  hemisphere.name = "foggy city hemisphere";

  const key = new DirectionalLight(look.lighting.keyColor, look.lighting.keyIntensity);
  key.name = "cool billboard key light";
  key.position.set(-28, 38, 19);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);

  scene.add(ambient, hemisphere, key);

  const applyLook = (nextLook: CityLook = look) => {
    scene.background = new Color(nextLook.fog.color);
    scene.fog = new FogExp2(nextLook.fog.color, nextLook.fog.density);

    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = nextLook.toneMapping.exposure;
    renderer.shadowMap.enabled = true;

    ambient.color.set(nextLook.lighting.ambientColor);
    ambient.intensity = nextLook.lighting.ambientIntensity;
    hemisphere.color.set(nextLook.lighting.hemiSkyColor);
    hemisphere.groundColor.set(nextLook.lighting.hemiGroundColor);
    hemisphere.intensity = nextLook.lighting.hemiIntensity;
    key.color.set(nextLook.lighting.keyColor);
    key.intensity = nextLook.lighting.keyIntensity;
  };

  applyLook(look);

  return { ambient, hemisphere, key, applyLook };
}
