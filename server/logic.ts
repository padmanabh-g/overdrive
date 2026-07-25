/**
 * Shared route bodies. Imported by both the local Fastify server (server/index.ts)
 * and the deployed Vercel Functions (api/*.ts) so there is exactly one implementation.
 */

const SHIBUYA = { lat: 35.6595, lon: 139.7005 }

export type Weather = {
  source: string
  live: boolean
  tempC: number
  precipMm: number
  windKph: number
  weatherCode: number
  error?: string
}

const WEATHER_FALLBACK: Weather = {
  source: 'fixture',
  live: false,
  tempC: 24,
  precipMm: 0,
  windKph: 8,
  weatherCode: 0,
}

export function integrations() {
  return {
    aiAnd: Boolean(process.env.AI_AND_API_KEY && process.env.AI_AND_BASE_URL),
    daytona: Boolean(process.env.DAYTONA_API_KEY),
  }
}

export async function weather(): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${SHIBUYA.lat}&longitude=${SHIBUYA.lon}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FTokyo`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const data = (await res.json()) as { current: Record<string, number> }
    const c = data.current
    return {
      source: 'open-meteo',
      live: true,
      tempC: c.temperature_2m ?? 0,
      precipMm: c.precipitation ?? 0,
      windKph: c.wind_speed_10m ?? 0,
      weatherCode: c.weather_code ?? 0,
    }
  } catch (err) {
    return { ...WEATHER_FALLBACK, error: String(err) }
  }
}

/** ODPT needs a token we do not have. Same shape as the live feed so swapping it in changes nothing. */
export function rail() {
  return {
    source: 'fixture',
    live: false,
    lines: [
      { name: 'Yamanote', status: 'normal' },
      { name: 'Ginza', status: 'normal' },
      { name: 'Hanzomon', status: 'normal' },
    ],
  }
}

/** ai& — the City Director. Fixture until credentials arrive. */
export async function cityDirector(condition?: string) {
  const key = process.env.AI_AND_API_KEY
  const baseUrl = process.env.AI_AND_BASE_URL

  if (!key || !baseUrl) {
    return { source: 'fixture', live: false, line: fixtureNarration(condition) }
  }

  // Confirm ai&'s API contract at the workshop before trusting this shape.
  return { source: 'ai&', live: false, line: fixtureNarration(condition) }
}

/** Daytona — the Probe sandbox. Fixture until credentials arrive. */
export async function probe() {
  if (!process.env.DAYTONA_API_KEY) {
    return { source: 'fixture', live: false, density: 0.55, note: 'no DAYTONA_API_KEY' }
  }
  return { source: 'daytona', live: false, density: 0.55, note: 'sandbox not wired yet' }
}

export function fixtureNarration(condition?: string): string {
  switch (condition) {
    case 'rain':
      return '雨 — Umbrellas bloom across the crossing. The crowd tightens and slows.'
    case 'surge':
      return 'ライブ終了 — The hall empties. Thousands spill toward the station at once.'
    case 'rail':
      return '運転見合わせ — The line is stopped. Foot traffic floods the side streets.'
    default:
      return '通常運転 — Tokyo moves at its usual pace.'
  }
}
