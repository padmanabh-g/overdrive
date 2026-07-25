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

export type DirectorEvent = {
  source: string
  live: boolean
  event: 'pickpocket' | 'checkpoint' | 'surge' | 'calm'
  where: 'drop' | 'station' | 'crossing'
  intensity: number
  line: string
  model?: string
}

export type DirectorEventInput = {
  tempC?: number
  precipMm?: number
  windKph?: number
  railDelays?: number
}

const EVENTS = ['pickpocket', 'checkpoint', 'surge', 'calm'] as const
const WHERES = ['drop', 'station', 'crossing'] as const

/** Pure: parse+validate the model's JSON into a DirectorEvent, or null on any defect. */
export function parseDirectorEvent(raw: string, fallbackLine: string): DirectorEvent | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (!EVENTS.includes(o.event as (typeof EVENTS)[number])) return null
  if (!WHERES.includes(o.where as (typeof WHERES)[number])) return null

  const n = Number(o.intensity)
  const intensity = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
  const line = typeof o.line === 'string' && o.line.trim() ? o.line.trim() : fallbackLine

  return {
    source: 'ai&',
    live: true,
    event: o.event as DirectorEvent['event'],
    where: o.where as DirectorEvent['where'],
    intensity,
    line,
  }
}

const DIRECTOR_EVENT_SYSTEM = [
  'You are the City Director of a live night simulation of Shibuya, Tokyo.',
  'Given the current real conditions, schedule the next street challenge.',
  'Output ONLY a JSON object, no prose, no code fence, with exactly these keys:',
  'event (one of: pickpocket, checkpoint, surge, calm),',
  'where (one of: drop, station, crossing),',
  'intensity (a number 0..1),',
  'line (a short Japanese word or phrase, an em dash, then one English sentence under 16 words).',
].join(' ')

/**
 * ai& as the City Director: returns a structured event scheduling the next challenge.
 * The game loop polls this, so it must never hang and never throw — any failure
 * (missing env, timeout, bad JSON, invalid enum) deterministically falls to localSchedule.
 */
export async function directorEvent(input: DirectorEventInput = {}): Promise<DirectorEvent> {
  const key = process.env.AI_AND_API_KEY
  const baseUrl = process.env.AI_AND_BASE_URL
  const model = process.env.AI_AND_MODEL

  if (!key || !baseUrl || !model) return localSchedule(input)

  const fallbackLine = localSchedule(input).line

  const facts = [
    input.tempC !== undefined ? `temperature: ${input.tempC.toFixed(0)}C` : null,
    input.precipMm !== undefined ? `precipitation: ${input.precipMm}mm` : null,
    input.windKph !== undefined ? `wind: ${input.windKph.toFixed(0)}km/h` : null,
    input.railDelays !== undefined ? `rail delays: ${input.railDelays}` : null,
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
          { role: 'system', content: DIRECTOR_EVENT_SYSTEM },
          { role: 'user', content: facts },
        ],
        temperature: 1,
        max_tokens: 160,
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`ai& ${res.status} ${(await res.text()).slice(0, 200)}`)

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) throw new Error('ai& returned no content')

    const parsed = parseDirectorEvent(raw.replace(/^```(?:json)?|```$/g, '').trim(), fallbackLine)
    if (!parsed) throw new Error('ai& returned unparseable event')
    return { ...parsed, model }
  } catch (err) {
    console.warn('[director] falling back to local schedule:', String(err))
    return localSchedule(input)
  }
}

/** Deterministic scheduler: same conditions always yield the same event. No randomness. */
export function localSchedule(input: DirectorEventInput = {}): DirectorEvent {
  const precip = input.precipMm ?? 0
  const wind = input.windKph ?? 0
  const delays = input.railDelays ?? 0
  const clamp = (n: number) => Math.min(1, Math.max(0, n))

  if (precip >= 1) {
    return event('surge', 'crossing', clamp(0.4 + precip / 10 + wind / 80), 'rain')
  }
  if (delays > 0) {
    return event('surge', 'station', clamp(0.4 + delays / 4), 'rail')
  }

  // Rotate on a stable index so no run gets stuck on one beat, but repeats deterministically.
  const idx = Math.abs(Math.floor((input.tempC ?? 0) + delays)) % 3
  if (idx === 0) return event('pickpocket', 'drop', 0.5, 'pickpocket')
  if (idx === 1) return event('checkpoint', 'station', 0.5, 'checkpoint')
  return event('calm', 'crossing', 0.2, 'calm')
}

const EVENT_LINES: Record<DirectorEvent['event'], string> = {
  pickpocket: 'スリ注意 — A hand drifts toward your bag in the throng.',
  checkpoint: '検問 — Officers wave a checkpoint up near the station.',
  surge: fixtureNarration('surge'),
  calm: fixtureNarration(),
}

function event(
  ev: DirectorEvent['event'],
  where: DirectorEvent['where'],
  intensity: number,
  condition?: string,
): DirectorEvent {
  const line =
    condition === 'rain' || condition === 'rail'
      ? fixtureNarration(condition)
      : EVENT_LINES[ev]
  return { source: 'fixture', live: false, event: ev, where, intensity, line }
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
