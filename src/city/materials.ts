import {
  Color,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
} from "three";

import type { CityLook } from "./look";

export type CityMaterials = {
  ground: MeshPhysicalMaterial;
  road: MeshPhysicalMaterial;
  building: MeshStandardMaterial;
  windows: MeshStandardMaterial;
  crosswalk: MeshBasicMaterial;
  reflection: MeshBasicMaterial;
  skyline: MeshBasicMaterial;
  rain: LineBasicMaterial;
  all: Material[];
};

export function createCityMaterials(look: CityLook, windowTexture: Texture, crosswalkTexture: Texture): CityMaterials {
  const ground = new MeshPhysicalMaterial({
    color: look.ground.asphaltColor,
    metalness: look.ground.metalness,
    roughness: look.ground.roughness,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  const road = new MeshPhysicalMaterial({
    color: look.ground.roadColor,
    metalness: look.ground.metalness,
    roughness: look.ground.roughness,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });

  const building = new MeshStandardMaterial({
    color: look.buildings.baseColor,
    roughness: 0.62,
    metalness: 0.12,
  });

  const windows = new MeshStandardMaterial({
    color: "#ffffff",
    map: windowTexture,
    emissive: new Color(look.buildings.windowEmissive),
    emissiveMap: windowTexture,
    emissiveIntensity: look.buildings.windowIntensity,
    roughness: 0.44,
    metalness: 0.18,
  });

  const crosswalk = new MeshBasicMaterial({
    map: crosswalkTexture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const reflection = new MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: look.ground.reflectionOpacity,
    depthWrite: false,
  });

  const skyline = new MeshBasicMaterial({
    color: look.skyline.color,
    transparent: true,
    opacity: look.skyline.opacity,
    depthWrite: false,
  });

  const rain = new LineBasicMaterial({
    color: look.rain.color,
    transparent: true,
    opacity: look.rain.opacity,
    depthWrite: false,
  });

  return {
    ground,
    road,
    building,
    windows,
    crosswalk,
    reflection,
    skyline,
    rain,
    all: [ground, road, building, windows, crosswalk, reflection, skyline, rain],
  };
}

export function applyLookToMaterials(materials: CityMaterials, look: CityLook): void {
  materials.ground.color.set(look.ground.asphaltColor);
  materials.ground.metalness = look.ground.metalness;
  materials.ground.roughness = look.ground.roughness;

  materials.road.color.set(look.ground.roadColor);
  materials.road.metalness = look.ground.metalness;
  materials.road.roughness = look.ground.roughness;

  materials.building.color.set(look.buildings.baseColor);
  materials.windows.emissive.set(look.buildings.windowEmissive);
  materials.windows.emissiveIntensity = look.buildings.windowIntensity;

  materials.reflection.opacity = look.ground.reflectionOpacity;
  materials.skyline.color.set(look.skyline.color);
  materials.skyline.opacity = look.skyline.opacity;
  materials.rain.color.set(look.rain.color);
  materials.rain.opacity = look.rain.opacity;
}
