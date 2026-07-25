/**
 * Game audio: one looping music bed (an mp3 asset) plus procedurally synthesised
 * one-shot SFX. The SFX are generated live with the Web Audio API — no sample files,
 * so the whole set costs a few hundred bytes of code instead of a folder of assets.
 *
 * Browsers block audio until a user gesture, so the AudioContext is created lazily
 * on the first `startMusic()`/`sfx()` call (both reachable only after the begin-run click).
 */

export type SfxName =
  | 'punch'
  | 'pickup'
  | 'beer'
  | 'steal'
  | 'recover'
  | 'cop'
  | 'redlight'
  | 'win'
  | 'lose'
  | 'surge'

class Audio {
  private ctx?: AudioContext
  private master?: GainNode
  private music?: HTMLAudioElement
  private cues: Record<string, HTMLAudioElement> = {}
  private muted = false

  constructor() {
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute()
    })
  }

  /** Call from a user gesture. Idempotent — starts the loop once, resumes if suspended. */
  startMusic(): void {
    this.ensureContext()
    if (!this.music) {
      const el = new self.Audio('/audio/bg.mp3')
      el.loop = true
      el.volume = this.muted ? 0 : 0.34
      this.music = el
    }
    void this.music.play().catch(() => {})
  }

  /** One-shot sample from a url, reusing one element per url. Restarts on each call. */
  cue(url: string): void {
    if (this.muted) return
    let el = this.cues[url]
    if (!el) {
      el = new self.Audio(url)
      el.volume = 0.5
      this.cues[url] = el
    }
    el.currentTime = 0
    void el.play().catch(() => {})
  }

  toggleMute(): void {
    this.muted = !this.muted
    if (this.music) this.music.volume = this.muted ? 0 : 0.34
    if (this.master) this.master.gain.value = this.muted ? 0 : 1
  }

  sfx(name: SfxName): void {
    if (this.muted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    switch (name) {
      case 'punch':
        this.tone(160, 60, t, 0.16, 'sine', 0.5)
        this.noise(t, 0.06, 0.4, 900)
        break
      case 'pickup':
        this.tone(660, 660, t, 0.08, 'triangle', 0.28)
        this.tone(990, 990, t + 0.08, 0.1, 'triangle', 0.28)
        break
      case 'beer':
        this.tone(320, 150, t, 0.5, 'sawtooth', 0.22)
        this.tone(300, 140, t, 0.5, 'sawtooth', 0.16) // detune → woozy beat
        break
      case 'steal':
        this.tone(820, 200, t, 0.16, 'sawtooth', 0.32)
        break
      case 'recover':
        this.tone(520, 1040, t, 0.16, 'triangle', 0.3)
        break
      case 'cop':
        this.tone(1800, 1800, t, 0.12, 'square', 0.22)
        this.tone(1800, 1800, t + 0.16, 0.12, 'square', 0.22)
        break
      case 'redlight':
        this.tone(200, 200, t, 0.14, 'square', 0.26)
        break
      case 'win':
        this.tone(523, 523, t, 0.14, 'triangle', 0.3)
        this.tone(659, 659, t + 0.13, 0.14, 'triangle', 0.3)
        this.tone(784, 784, t + 0.26, 0.22, 'triangle', 0.3)
        break
      case 'lose':
        this.tone(392, 392, t, 0.2, 'sawtooth', 0.28)
        this.tone(294, 294, t + 0.18, 0.35, 'sawtooth', 0.28)
        break
      case 'surge':
        this.noise(t, 0.7, 0.28, 1600, true)
        break
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (!this.ctx) {
      const Ctor = self.AudioContext ?? (self as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return undefined
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** One oscillator with a linear-ramp gain envelope. `endFreq` sweeps if it differs from freq. */
  private tone(freq: number, endFreq: number, start: number, dur: number, type: OscillatorType, peak: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + dur)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain).connect(this.master!)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }

  /** Filtered white-noise burst. `swell` fades in instead of out (used for the surge). */
  private noise(start: number, dur: number, peak: number, cutoff: number, swell = false): void {
    const ctx = this.ctx!
    const frames = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const gain = ctx.createGain()
    if (swell) {
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(peak, start + dur * 0.7)
      gain.gain.linearRampToValueAtTime(0.0001, start + dur)
    } else {
      gain.gain.setValueAtTime(peak, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    }
    src.connect(filter).connect(gain).connect(this.master!)
    src.start(start)
    src.stop(start + dur + 0.02)
  }
}

export const audio = new Audio()
