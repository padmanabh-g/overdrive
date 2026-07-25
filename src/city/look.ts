export type CityLook = {
  fog: {
    color: string;
    density: number;
  };
  toneMapping: {
    exposure: number;
  };
  bloom: {
    intensity: number;
    luminanceThreshold: number;
    luminanceSmoothing: number;
    mipmapBlur: boolean;
  };
  ssao: {
    enabled: boolean;
    intensity: number;
    radius: number;
    samples: number;
    resolutionScale: number;
  };
  lighting: {
    ambientColor: string;
    ambientIntensity: number;
    hemiSkyColor: string;
    hemiGroundColor: string;
    hemiIntensity: number;
    keyColor: string;
    keyIntensity: number;
  };
  ground: {
    width: number;
    depth: number;
    asphaltColor: string;
    roadColor: string;
    roughness: number;
    metalness: number;
    reflectionOpacity: number;
  };
  buildings: {
    blockSize: number;
    rows: number;
    columns: number;
    minHeight: number;
    maxHeight: number;
    baseColor: string;
    windowEmissive: string;
    windowIntensity: number;
  };
  neon: {
    intensity: number;
    signWidth: number;
    signHeight: number;
    signsPerTallBuilding: number;
    colors: string[];
    copy: string[];
  };
  rain: {
    enabled: boolean;
    count: number;
    height: number;
    radius: number;
    color: string;
    opacity: number;
    speed: number;
  };
  skyline: {
    enabled: boolean;
    color: string;
    opacity: number;
  };
};

export const cityLook: CityLook = {
  fog: {
    color: "#07111b",
    density: 0.024,
  },
  toneMapping: {
    exposure: 1.28,
  },
  bloom: {
    intensity: 1.45,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.22,
    mipmapBlur: true,
  },
  ssao: {
    enabled: true,
    intensity: 0.62,
    radius: 8,
    samples: 16,
    resolutionScale: 0.55,
  },
  lighting: {
    ambientColor: "#5b6f88",
    ambientIntensity: 0.42,
    hemiSkyColor: "#18243a",
    hemiGroundColor: "#050506",
    hemiIntensity: 0.74,
    keyColor: "#a8e8ff",
    keyIntensity: 1.85,
  },
  ground: {
    width: 180,
    depth: 240,
    asphaltColor: "#07090c",
    roadColor: "#050608",
    roughness: 0.18,
    metalness: 0.78,
    reflectionOpacity: 0.38,
  },
  buildings: {
    blockSize: 18,
    rows: 8,
    columns: 7,
    minHeight: 12,
    maxHeight: 46,
    baseColor: "#111722",
    windowEmissive: "#ffe8b4",
    windowIntensity: 1.85,
  },
  neon: {
    intensity: 3.8,
    signWidth: 2.3,
    signHeight: 7.2,
    signsPerTallBuilding: 3,
    colors: ["#ff2f8f", "#00e5ff", "#ffd23f", "#48ff7b", "#9157ff", "#ff5a36"],
    copy: ["ラーメン", "カラオケ", "ゲーム", "シネマ", "バー", "寿司", "渋谷", "ライブ"],
  },
  rain: {
    enabled: true,
    count: 760,
    height: 34,
    radius: 86,
    color: "#9edcff",
    opacity: 0.34,
    speed: 27,
  },
  skyline: {
    enabled: true,
    color: "#07101c",
    opacity: 0.82,
  },
};

export function cloneCityLook(source: CityLook = cityLook): CityLook {
  return structuredClone(source) as CityLook;
}
