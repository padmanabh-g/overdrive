export type Weather = {
  source: string
  live: boolean
  tempC: number
  precipMm: number
  windKph: number
  weatherCode: number
}

export type Rail = {
  source: string
  live: boolean
  lines: { name: string; status: string }[]
}

export type Narration = { source: string; live: boolean; line: string }
export type Probe = { source: string; live: boolean; density: number; note?: string }

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`${path} ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    console.warn('[feeds] falling back:', err)
    return fallback
  }
}

async function post<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${path} ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    console.warn('[feeds] falling back:', err)
    return fallback
  }
}

export const feeds = {
  weather: () =>
    get<Weather>('/api/weather', {
      source: 'offline',
      live: false,
      tempC: 24,
      precipMm: 0,
      windKph: 8,
      weatherCode: 0,
    }),

  rail: () =>
    get<Rail>('/api/rail', {
      source: 'offline',
      live: false,
      lines: [{ name: 'Yamanote', status: 'normal' }],
    }),

  // ai& — the City Director.
  narrate: (condition: string) =>
    post<Narration>('/api/city-director', { condition }, {
      source: 'offline',
      live: false,
      line: '',
    }),

  // Daytona — the Probe sandbox.
  probeDensity: () =>
    post<Probe>('/api/probe', {}, { source: 'offline', live: false, density: 0.5 }),
}

/** WMO codes: 51+ is drizzle upward. Anything at or above that counts as rain. */
export function isRaining(w: Weather): boolean {
  return w.precipMm > 0 || w.weatherCode >= 51
}
