// FSRS-5 (Free Spaced Repetition Scheduler) s privzetimi utežmi.
// Isti algoritem kot v Anki; za vsak predmet učenja vodi stabilnost (S) in težavnost (D) spomina.

export type Grade = 1 | 2 | 3 | 4 // 1 pozabil, 2 težko, 3 dobro, 4 lahko

export interface MemState {
  S: number // stabilnost v dneh
  D: number // težavnost 1 do 10
  reps: number
  lapses: number
  last: number // ms
  due: number // ms
  seen: number
  correct: number
  errs?: Partial<Record<'inf' | 'past' | 'pp', number>>
  hist?: number[]
  /** zaporedni pravilni prvi odgovori (po sejah); 2 ali več pomeni »znam« */
  run?: number
  /** čas zadnje spremembe, za sinhronizacijo */
  u: number
}

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]
const DECAY = -0.5
const FACTOR = 19 / 81
export const DAY = 864e5
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

export const R = (t: number, S: number) => Math.pow(1 + (FACTOR * t) / S, DECAY)
const ivl = (S: number, r: number) => (S / FACTOR) * (Math.pow(r, 1 / DECAY) - 1)
const S0 = (g: Grade) => Math.max(W[g - 1], 0.1)
const D0 = (g: number) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10)
const nextD = (D: number, g: Grade) => {
  const d = D + -W[6] * (g - 3) * ((10 - D) / 9)
  return clamp(W[7] * D0(4) + (1 - W[7]) * d, 1, 10)
}
const recallS = (D: number, S: number, r: number, g: Grade) =>
  S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1))
const forgetS = (D: number, S: number, r: number) =>
  Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)))
const shortS = (S: number, g: Grade) => S * Math.exp(W[17] * (g - 3 + W[18]))

export function emptyState(): MemState {
  return { S: 0, D: 0, reps: 0, lapses: 0, last: 0, due: 0, seen: 0, correct: 0, hist: [], u: 0 }
}

export function retrievability(c: MemState | undefined, now = Date.now()): number {
  if (!c || !c.reps) return 0
  return R(Math.max(0, (now - c.last) / DAY), c.S)
}

function intervalDays(S: number, retention: number, g: Grade) {
  let iv = ivl(S, retention)
  if (g === 1) iv = Math.min(iv, 1)
  return iv >= 1 ? Math.round(iv) : Math.max(iv, 10 / 1440)
}

/** Glavna ocena: prvi odgovor v seji. Vrne nov objekt. */
export function review(prev: MemState, g: Grade, now: number, retention: number): MemState {
  const c = { ...prev }
  if (!c.reps) {
    c.S = S0(g)
    c.D = D0(g)
  } else {
    const t = (now - c.last) / DAY
    if (t < 0.5) {
      c.S = Math.max(0.05, shortS(c.S, g))
      c.D = nextD(c.D, g)
    } else {
      const r = R(t, c.S)
      const D = c.D
      c.D = nextD(D, g)
      c.S = g === 1 ? forgetS(D, c.S, r) : recallS(D, c.S, r, g)
    }
  }
  c.S = clamp(c.S, 0.05, 36500)
  c.reps += 1
  if (g === 1) c.lapses += 1
  c.last = now
  c.due = now + intervalDays(c.S, retention, g) * DAY
  c.u = now
  return c
}

/** Ponovna pravilna rešitev v isti seji (po napaki): kratkoročna okrepitev. */
export function reinforce(prev: MemState, now: number, retention: number): MemState {
  const c = { ...prev }
  c.S = clamp(shortS(c.S, 3), 0.05, 36500)
  c.last = now
  c.due = now + intervalDays(c.S, retention, 3) * DAY
  c.u = now
  return c
}

/** Predogled intervala za gumbe samoocene. */
export function previewDays(prev: MemState, g: Grade, now: number, retention: number) {
  const n = review(prev, g, now, retention)
  return (n.due - now) / DAY
}

export type Maturity = 'new' | 'learn' | 'young' | 'mature'
/** Zaporedni pravilni odgovori; za stare zapise brez »run« se izračuna iz zgodovine. */
export function runOf(c?: MemState): number {
  if (!c || !c.reps) return 0
  if (typeof c.run === 'number') return c.run
  let n = 0
  const h = c.hist || []
  for (let i = h.length - 1; i >= 0 && h[i] === 1; i--) n++
  return n
}
/** Znanje glagola po smiselnem pravilu:
 *  new = še nikoli vprašan, learn = zadnji odgovor napačen, young = enkrat pravilno, mature (znam) = dvakrat zapored pravilno
 *  ali pravilno že ob prvem srečanju. */
export function maturity(c?: MemState): Maturity {
  if (!c || !c.reps) return 'new'
  const r = runOf(c)
  if (r >= 2) return 'mature'
  if (r === 1) return 'young'
  return 'learn'
}
export const isKnown = (c?: MemState) => maturity(c) === 'mature'

export function weakness(c: MemState | undefined, now = Date.now()) {
  if (!c || !c.reps) return 0
  const errs = (c.errs?.inf || 0) + (c.errs?.past || 0) + (c.errs?.pp || 0)
  const acc = c.seen ? c.correct / c.seen : 1
  return c.lapses * 2 + errs * 0.6 + (1 - acc) * 4 + (1 - retrievability(c, now)) * 5 + (c.D || 5) / 5
}
export const isWeak = (c?: MemState) =>
  !!c && c.reps > 0 && (c.lapses > 0 || (c.errs?.inf || 0) + (c.errs?.past || 0) + (c.errs?.pp || 0) > 0 || c.D > 6)

export function fmtInterval(days: number) {
  if (days < 1 / 24) return Math.max(1, Math.round(days * 1440)) + ' min'
  if (days < 1) return Math.round(days * 24) + ' h'
  if (days < 45) return Math.round(days) + ' d'
  if (days < 365) return Math.round(days / 30) + ' mes'
  return (days / 365).toFixed(1).replace('.', ',') + ' let'
}
export const fmtDue = (due: number, now = Date.now()) => (due <= now ? 'zdaj' : fmtInterval((due - now) / DAY))
