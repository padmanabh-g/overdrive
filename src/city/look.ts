/**
 * Jun owns this file. Every visual constant lives here; the lil-gui panel binds
 * to it live in the browser, and tuned values get committed back.
 * Nothing outside src/city and src/render should write to it.
 */
export const look = {
  // Atmosphere
  fogColor: 0x0a0d18,
  fogDensity: 0.011,
  skyTop: 0x0a0f1f,
  skyBottom: 0x1d1430,
  exposure: 1.15,

  // Lighting
  ambientColor: 0x2a3352,
  ambientIntensity: 0.55,
  moonColor: 0x9fb4ff,
  moonIntensity: 0.35,
  streetLightColor: 0xffb066,
  streetLightIntensity: 12,

  // Ground — wet asphalt reads as rain even when it is not raining
  groundColor: 0x0b0d13,
  groundMetalness: 0.86,
  groundRoughness: 0.28,
  roadColor: 0x12151d,
  reflectionOpacity: 0.34,
  reflectionLength: 13,

  // Buildings
  buildingColor: 0x14171f,
  buildingRoughness: 0.72,
  buildingMetalness: 0.12,
  windowLitChance: 0.42,
  windowColor: '#ffd9a0',
  windowColorAlt: '#a8c8ff',

  // Neon
  neonHues: [335, 190, 275, 45, 155, 5],
  neonSaturation: 0.95,
  neonLightness: 0.6,
  neonIntensity: 2.6,
  signChance: 0.72,

  // Post
  bloomIntensity: 1.35,
  bloomThreshold: 0.28,
  bloomSmoothing: 0.4,
  bloomRadius: 0.72,

  // Rain
  rainCount: 9000,
  rainColor: 0xaec4e8,
  rainOpacity: 0.34,
  rainSpeed: 34,
}

export type Look = typeof look
