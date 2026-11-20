// Kratki sintetizirani zvoki (Web Audio), brez datotek. Sprožijo se v istem okvirju kot animacija.
let ctx: AudioContext | null = null
function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}
function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, glide?: number) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + start
  const o = a.createOscillator()
  const g = a.createGain()
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 4200
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(f).connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let enabled = true
export const setSoundEnabled = (v: boolean) => { enabled = v }

export const sfx = {
  tap() { if (enabled) tone(1400, 0, 0.035, 'sine', 0.025) },
  key() { if (enabled) tone(900 + Math.random() * 180, 0, 0.03, 'triangle', 0.018) },
  ok(streak = 0) {
    if (!enabled) return
    const base = 660 * Math.pow(2, Math.min(streak, 7) / 12)
    tone(base, 0, 0.16, 'sine', 0.09)
    tone(base * 1.26, 0.07, 0.22, 'sine', 0.08)
    tone(base * 2, 0.07, 0.18, 'triangle', 0.02)
  },
  bad() {
    if (!enabled) return
    tone(196, 0, 0.22, 'triangle', 0.08, 140)
    tone(147, 0.05, 0.26, 'sine', 0.06, 110)
  },
  combo(n: number) {
    if (!enabled) return
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => tone(f * (n >= 10 ? 1.5 : 1), i * 0.06, 0.2, 'sine', 0.06))
  },
  finish() {
    if (!enabled) return
    ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.4, 'sine', 0.06))
  },
}
