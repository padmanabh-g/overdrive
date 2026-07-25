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

export type DirectorInput = {
  condition?: string
  tempC?: number
  precipMm?: number
  windKph?: number
}

const DIRECTOR_SYSTEM = [
  'You are the City Director of a live simulation of Shibuya, Tokyo, at night.',
  'Given the current real conditions, write ONE line describing how the city and its',
  'crowds are reacting right now. Format: a short Japanese word or phrase, an em dash,',
  'then one English sentence under 16 words. Concrete and physical — what bodies in the',
  'street are doing. No preamble, no quotes, no explanation. Output only the line.',
].join(' ')

/**
 * ai& — the City Director. OpenAI-compatible, so plain fetch; no SDK needed.
 * Any failure or slow response falls back to the fixture: the game loop calls this,
 * so it must never hang and must never throw.
 */
export async function cityDirector(input: DirectorInput = {}) {
  const key = process.env.AI_AND_API_KEY
  const baseUrl = process.env.AI_AND_BASE_URL
  const model = process.env.AI_AND_MODEL

  if (!key || !baseUrl || !model) {
    return { source: 'fixture', live: false, line: fixtureNarration(input.condition) }
  }

  const facts = [
    `event: ${input.condition ?? 'normal'}`,
    input.tempC !== undefined ? `temperature: ${input.tempC.toFixed(0)}C` : null,
    input.precipMm !== undefined ? `precipitation: ${input.precipMm}mm` : null,
    input.windKph !== undefined ? `wind: ${input.windKph.toFixed(0)}km/h` : null,
  ]
    .filter(Boolean)
    .join(', ')

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM },
          { role: 'user', content: facts },
        ],
        temperature: 1,
        max_tokens: 120,
        // No reasoning_effort: DeepSeek then spends the whole budget on a `reasoning`
        // field and returns content: null. One short line needs no reasoning pass.
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`ai& ${res.status} ${(await res.text()).slice(0, 200)}`)

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const line = data.choices?.[0]?.message?.content?.trim()
    if (!line) throw new Error('ai& returned no content')

    return { source: 'ai&', live: true, model, line: line.replace(/^["'`]|["'`]$/g, '') }
  } catch (err) {
    console.warn('[city-director] falling back to fixture:', String(err))
    return { source: 'fixture', live: false, line: fixtureNarration(input.condition) }
  }
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
