export type DistrictId = "shibuya" | "tokyo" | "roppongi" | "tokyo-tower" | "kyoto";

export type CityLook = {
  district: {
    id: DistrictId;
    label: string;
  };
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
    envIntensity: number;
  };
  ground: {
    width: number;
    depth: number;
    asphaltColor: string;
    roadColor: string;
    verticalRoadWidth: number;
    horizontalRoadWidth: number;
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
    signChance: number;
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

const shibuyaLook: CityLook = {
  district: {
    id: "shibuya",
    label: "Shibuya",
  },
  fog: {
    color: "#07111b",
    density: 0.0075,
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
    envIntensity: 0.13,
  },
  ground: {
    width: 180,
    depth: 240,
    asphaltColor: "#07090c",
    roadColor: "#050608",
    verticalRoadWidth: 28,
    horizontalRoadWidth: 26,
    roughness: 0.18,
    metalness: 0.78,
    reflectionOpacity: 0.38,
  },
  buildings: {
    blockSize: 18,
    rows: 8,
    columns: 7,
    minHeight: 16,
    maxHeight: 58,
    baseColor: "#111722",
    windowEmissive: "#ffe8b4",
    windowIntensity: 1.85,
  },
  neon: {
    intensity: 3.8,
    signWidth: 2.3,
    signHeight: 7.2,
    signsPerTallBuilding: 3,
    signChance: 0.65,
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

export const cityLooks: Record<DistrictId, CityLook> = {
  shibuya: shibuyaLook,
  tokyo: {
    ...cloneCityLook(shibuyaLook),
    district: {
      id: "tokyo",
      label: "Tokyo Station",
    },
    fog: {
      color: "#08121a",
      density: 0.018,
    },
    toneMapping: {
      exposure: 1.36,
    },
    lighting: {
      ambientColor: "#7f8da0",
      ambientIntensity: 0.62,
      hemiSkyColor: "#1b2a38",
      hemiGroundColor: "#050607",
      hemiIntensity: 0.92,
      keyColor: "#f3d08a",
      keyIntensity: 2.2,
      envIntensity: 0.13,
    },
    ground: {
      ...shibuyaLook.ground,
      width: 220,
      depth: 260,
      verticalRoadWidth: 38,
      horizontalRoadWidth: 34,
      reflectionOpacity: 0.3,
    },
    buildings: {
      ...shibuyaLook.buildings,
      blockSize: 20,
      rows: 8,
      columns: 8,
      minHeight: 22,
      maxHeight: 68,
      baseColor: "#151d25",
      windowEmissive: "#ffe1a2",
      windowIntensity: 2.25,
    },
    neon: {
      ...shibuyaLook.neon,
      intensity: 2.9,
      signWidth: 3,
      signHeight: 5.6,
      signsPerTallBuilding: 2,
      signChance: 0.38,
      colors: ["#f7c76b", "#92c8ff", "#ffffff", "#72f0d4", "#ff6f91"],
      copy: ["東京駅", "丸の内", "八重洲", "DINING", "HOTEL", "TAXI", "CAFE"],
    },
    skyline: {
      enabled: true,
      color: "#09131b",
      opacity: 0.92,
    },
  },
  roppongi: {
    ...cloneCityLook(shibuyaLook),
    district: {
      id: "roppongi",
      label: "Roppongi",
    },
    fog: {
      color: "#090d18",
      density: 0.016,
    },
    toneMapping: {
      exposure: 1.42,
    },
    bloom: {
      ...shibuyaLook.bloom,
      intensity: 1.72,
      luminanceThreshold: 0.78,
    },
    lighting: {
      ambientColor: "#6d718f",
      ambientIntensity: 0.52,
      hemiSkyColor: "#17152b",
      hemiGroundColor: "#060506",
      hemiIntensity: 0.8,
      keyColor: "#d6c4ff",
      keyIntensity: 2.45,
      envIntensity: 0.13,
    },
    ground: {
      ...shibuyaLook.ground,
      width: 190,
      depth: 230,
      verticalRoadWidth: 24,
      horizontalRoadWidth: 22,
      asphaltColor: "#08080d",
      roadColor: "#040407",
      reflectionOpacity: 0.44,
    },
    buildings: {
      ...shibuyaLook.buildings,
      blockSize: 19,
      rows: 8,
      columns: 7,
      minHeight: 24,
      maxHeight: 78,
      baseColor: "#101827",
      windowEmissive: "#dbe8ff",
      windowIntensity: 2.4,
    },
    neon: {
      ...shibuyaLook.neon,
      intensity: 4.2,
      signWidth: 3.4,
      signHeight: 5,
      signsPerTallBuilding: 1,
      signChance: 0.28,
      colors: ["#7d5cff", "#00d1ff", "#ff3d9a", "#f8f4d8", "#55ffba"],
      copy: ["六本木", "CLUB", "GALLERY", "LOUNGE", "MUSIC", "ART", "BAR"],
    },
  },
  "tokyo-tower": {
    ...cloneCityLook(shibuyaLook),
    district: {
      id: "tokyo-tower",
      label: "Tokyo Tower",
    },
    fog: {
      color: "#0a1015",
      density: 0.019,
    },
    toneMapping: {
      exposure: 1.34,
    },
    bloom: {
      ...shibuyaLook.bloom,
      intensity: 1.55,
      luminanceThreshold: 0.82,
    },
    lighting: {
      ambientColor: "#6f7382",
      ambientIntensity: 0.54,
      hemiSkyColor: "#161f29",
      hemiGroundColor: "#050605",
      hemiIntensity: 0.84,
      keyColor: "#ffb16b",
      keyIntensity: 2.35,
      envIntensity: 0.13,
    },
    ground: {
      ...shibuyaLook.ground,
      width: 200,
      depth: 240,
      verticalRoadWidth: 26,
      horizontalRoadWidth: 24,
      asphaltColor: "#070907",
      roadColor: "#040504",
      reflectionOpacity: 0.34,
    },
    buildings: {
      ...shibuyaLook.buildings,
      blockSize: 19,
      rows: 8,
      columns: 7,
      minHeight: 12,
      maxHeight: 42,
      baseColor: "#121a1b",
      windowEmissive: "#ffd2a0",
      windowIntensity: 1.9,
    },
    neon: {
      ...shibuyaLook.neon,
      intensity: 3.2,
      signWidth: 2.8,
      signHeight: 5.8,
      signsPerTallBuilding: 2,
      signChance: 0.34,
      colors: ["#ff5a36", "#ffb04a", "#f7f1d0", "#8fd7ff", "#ff3f7f"],
      copy: ["東京タワー", "芝公園", "HOTEL", "VIEW", "CAFE", "PHOTO"],
    },
    skyline: {
      enabled: true,
      color: "#07100e",
      opacity: 0.76,
    },
  },
  kyoto: {
    ...cloneCityLook(shibuyaLook),
    district: {
      id: "kyoto",
      label: "Kyoto",
    },
    fog: {
      color: "#11100d",
      density: 0.021,
    },
    toneMapping: {
      exposure: 1.24,
    },
    bloom: {
      ...shibuyaLook.bloom,
      intensity: 1.18,
      luminanceThreshold: 1.02,
    },
    lighting: {
      ambientColor: "#76664d",
      ambientIntensity: 0.58,
      hemiSkyColor: "#1d1b17",
      hemiGroundColor: "#090705",
      hemiIntensity: 0.78,
      keyColor: "#ffd08a",
      keyIntensity: 1.75,
      envIntensity: 0.13,
    },
    ground: {
      ...shibuyaLook.ground,
      width: 170,
      depth: 220,
      verticalRoadWidth: 18,
      horizontalRoadWidth: 18,
      asphaltColor: "#0b0a07",
      roadColor: "#050403",
      roughness: 0.24,
      metalness: 0.46,
      reflectionOpacity: 0.28,
    },
    buildings: {
      ...shibuyaLook.buildings,
      blockSize: 17,
      rows: 8,
      columns: 7,
      minHeight: 7,
      maxHeight: 22,
      baseColor: "#1a1712",
      windowEmissive: "#ffbd72",
      windowIntensity: 1.5,
    },
    neon: {
      ...shibuyaLook.neon,
      intensity: 2.2,
      signWidth: 2.2,
      signHeight: 4.4,
      signsPerTallBuilding: 1,
      signChance: 0.18,
      colors: ["#ff8a3d", "#ffd36b", "#d43727", "#f7efe0", "#8fcf9b"],
      copy: ["京都", "祇園", "茶屋", "和菓子", "旅館", "庭園"],
    },
    rain: {
      ...shibuyaLook.rain,
      color: "#d4c9a8",
      opacity: 0.24,
    },
    skyline: {
      enabled: true,
      color: "#0d0b08",
      opacity: 0.52,
    },
  },
};

export const cityLook: CityLook = cloneCityLook(cityLooks[resolveDistrictId()]);

export function cloneCityLook(source: CityLook = cityLook): CityLook {
  return structuredClone(source) as CityLook;
}

export function resolveDistrictId(search = globalThis.location?.search ?? ""): DistrictId {
  const district = new URLSearchParams(search).get("district")?.toLowerCase();

  if (district === "tokyo" || district === "marunouchi" || district === "station") {
    return "tokyo";
  }

  if (district === "roppongi" || district === "roppongi-hills" || district === "六本木") {
    return "roppongi";
  }

  if (district === "tokyo-tower" || district === "tokyotower" || district === "tower" || district === "東京タワー") {
    return "tokyo-tower";
  }

  if (district === "kyoto" || district === "gion" || district === "京都" || district === "祇園") {
    return "kyoto";
  }

  return "shibuya";
}
