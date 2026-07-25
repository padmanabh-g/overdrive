import type { Rail, Weather } from '../data/feeds'
import type { Run } from '../game/run'

const el = (id: string) => document.getElementById(id)!

const objective = el('objective')
const conditions = el('conditions')
const narration = el('narration')

let narrationTimer: ReturnType<typeof setTimeout> | undefined

export function showNarration(line: string): void {
  if (!line) return
  narration.textContent = line
  narration.classList.add('show')
  clearTimeout(narrationTimer)
  narrationTimer = setTimeout(() => narration.classList.remove('show'), 7000)
}

export function updateObjective(run: Run, distance: number, drag: number): void {
  const mm = Math.floor(run.timeLeft / 60)
  const ss = Math.floor(run.timeLeft % 60)
  const urgent = run.timeLeft < 30

  const status =
    run.state === 'won'
      ? '<span style="color:#54ffc8">DELIVERED</span>'
      : run.state === 'lost'
        ? '<span class="warn">TIME OUT — press R</span>'
        : `${Math.round(distance)} m to drop`

  objective.innerHTML = `
    <div class="label">Time remaining</div>
    <div class="big${urgent ? ' warn' : ''}">${mm}:${String(ss).padStart(2, '0')}</div>
    <div class="row"><span>Objective</span><span>${status}</span></div>
    <div class="row"><span>Crowd drag</span><span${drag > 0.6 ? ' class="warn"' : ''}>${Math.round(drag * 100)}%</span></div>
  `
}

export function updateConditions(weather: Weather, rail: Rail, density: number, raining: boolean): void {
  const disrupted = rail.lines.filter((l) => l.status !== 'normal')

  conditions.innerHTML = `
    <div class="label">Live Tokyo — Shibuya</div>
    <div class="row"><span>Weather</span><span${raining ? ' class="warn"' : ''}>${raining ? 'Rain' : 'Clear'} ${weather.tempC.toFixed(0)}&deg;C</span></div>
    <div class="row"><span>Wind</span><span>${weather.windKph.toFixed(0)} km/h</span></div>
    <div class="row"><span>Crowd density</span><span>${Math.round(density * 100)}%</span></div>
    <div class="row"><span>Rail</span><span${disrupted.length ? ' class="warn"' : ''}>${disrupted.length ? `${disrupted[0]!.name} delayed` : 'Normal'}</span></div>
    <div class="row"><span>Feeds</span><span>${weather.live ? 'live' : weather.source}</span></div>
  `
}
