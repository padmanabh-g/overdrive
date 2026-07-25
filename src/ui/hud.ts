import type { Rail, Weather } from '../data/feeds'
import type { Run } from '../game/run'

const el = (id: string) => document.getElementById(id)!

const narration = el('narration')
let narrationTimer: ReturnType<typeof setTimeout> | undefined

export function showNarration(line: string): void {
  if (!line) return
  narration.textContent = line
  narration.classList.add('show')
  clearTimeout(narrationTimer)
  narrationTimer = setTimeout(() => narration.classList.remove('show'), 7000)
}

// Build each panel's DOM once, then mutate text/meter-width per tick so CSS
// transitions animate instead of restarting on every innerHTML rewrite.
function panel(id: string, head: string, rows: string): void {
  el(id).innerHTML = `<div class="hud-head">${head}</div><div class="hud-body">${rows}</div>`
}

function metric(key: string, id: string): string {
  return `<div class="metric"><span class="k">${key}</span><span class="v" id="${id}"></span></div>`
}

function meter(id: string): string {
  return `<div class="meter" id="${id}"><i></i></div>`
}

let built = false
function build(): void {
  panel(
    'objective',
    `Mission<span class="spacer"></span>渋谷便`,
    `<div class="timer" id="hud-timer">--:--</div>` +
      metric('Objective', 'hud-obj') +
      metric('Crowd drag', 'hud-drag-v') +
      meter('hud-drag-m'),
  )
  panel(
    'conditions',
    `Live Tokyo<span class="spacer"></span><span class="live" id="hud-live"><span class="dot"></span>LIVE</span>`,
    metric('Weather', 'hud-wx') +
      metric('Wind', 'hud-wind') +
      metric('Crowd density', 'hud-dens-v') +
      meter('hud-dens-m') +
      metric('Rail', 'hud-rail'),
  )
  built = true
}

function set(id: string, text: string, cls = 'v'): void {
  const node = el(id)
  node.textContent = text
  node.className = cls
}

function fill(id: string, pct: number, hot: boolean): void {
  const node = el(id)
  node.className = hot ? 'meter hot' : 'meter'
  ;(node.firstElementChild as HTMLElement).style.width = `${Math.round(pct * 100)}%`
}

export function updateObjective(run: Run, distance: number, drag: number): void {
  if (!built) build()

  const mm = Math.floor(run.timeLeft / 60)
  const ss = Math.floor(run.timeLeft % 60)
  const urgent = run.state === 'running' && run.timeLeft < 30

  const timer = el('hud-timer')
  timer.textContent = `${mm}:${String(ss).padStart(2, '0')}`
  timer.className = urgent ? 'timer urgent' : 'timer'

  if (run.state === 'won') set('hud-obj', 'DELIVERED', 'v good')
  else if (run.state === 'lost') set('hud-obj', 'TIME OUT · R', 'v warn')
  else set('hud-obj', `${run.delivered}/${run.total} · ${Math.round(distance)} m`, 'v strong')

  set('hud-drag-v', `${Math.round(drag * 100)}%`, drag > 0.6 ? 'v warn' : 'v')
  fill('hud-drag-m', drag, drag > 0.6)
}

export function updateConditions(weather: Weather, rail: Rail, density: number, raining: boolean): void {
  if (!built) build()

  const live = el('hud-live')
  live.className = weather.live ? 'live' : 'live off'
  live.lastChild!.textContent = weather.live ? 'LIVE' : (weather.source ?? 'offline').toUpperCase()

  set('hud-wx', `${raining ? 'Rain' : 'Clear'} · ${weather.tempC.toFixed(0)}°C`, raining ? 'v strong' : 'v')
  set('hud-wind', `${weather.windKph.toFixed(0)} km/h`)

  set('hud-dens-v', `${Math.round(density * 100)}%`, density > 0.7 ? 'v warn' : 'v')
  fill('hud-dens-m', density, density > 0.7)

  const disrupted = rail.lines.filter((l) => l.status !== 'normal')
  if (disrupted.length) set('hud-rail', `${disrupted[0]!.name} delayed`, 'v warn')
  else set('hud-rail', 'Normal', 'v good')
}
