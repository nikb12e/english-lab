// The adaptive part of the algorithm.
// 1) Every verb has a difficulty estimate (b) from its features: frequency, pattern, irregularity, confusability, alternative forms.
// 2) The user has an ability θ (Elo/Rasch). After every first answer θ and b are updated.
// 3) New verbs are chosen so the probability of success is close to the target (“desirable difficulty”), easy ones are skipped after placement.
// 4) The task type is chosen by memory stability: from supported recall to sentences, spotting mistakes and dictation.

import { VERBS, type Verb } from './verbs'
import { lev } from './check'
import type { MemState } from './fsrs'

const CONFUSABLE = new Set(['lie', 'lay', 'rise', 'arise', 'fall', 'feel', 'find', 'wind', 'wake', 'awake', 'bear', 'strew', 'sew', 'sow', 'shine', 'spit', 'spill', 'spoil', 'tread', 'stride', 'strive', 'slink', 'sling', 'sting', 'stink', 'swing', 'sink', 'shrink', 'spring', 'lead', 'lend', 'leave', 'lose', 'loose', 'hang', 'heave', 'hew', 'beseech', 'bereave', 'cling', 'fling', 'smite', 'slay', 'stick'])

/** Verb difficulty on the θ scale (about −2 easy … +2.5 brutal). */
export function verbPrior(v: Verb): number {
  const a = v.shown.inf[0], b = v.shown.past[0], c = v.shown.pp[0]
  let d = -1.6
  d += (v.tier - 1) * 1.05 // rarity
  d += { AAA: -0.35, AAB: 0.25, ABA: 0.1, ABB: 0.15, ABC: 0.55 }[v.type]
  d += Math.min(1.2, (lev(a, b) + lev(a, c)) * 0.12) // how much the two forms differ
  if (CONFUSABLE.has(v.id)) d += 0.45
  if (v.shown.past.length > 1 || v.shown.pp.length > 1) d += 0.3 // two forms on the sheet
  if (/(ought|aught)$/.test(b)) d += 0.15
  if (v.note) d += 0.2
  return Math.round(d * 100) / 100
}
export const PRIOR: Record<string, number> = Object.fromEntries(VERBS.map((v) => [v.id, verbPrior(v)]))

export const pSuccess = (theta: number, b: number) => 1 / (1 + Math.exp(-(theta - b) * 1.25))

/** Elo update. Returns the new θ and the new b. */
export function updateAbility(theta: number, b: number, ok: boolean, n: number) {
  const p = pSuccess(theta, b)
  const k = Math.max(0.12, 0.6 / Math.sqrt(1 + n / 8)) // learns fast at first, then settles
  const r = ok ? 1 : 0
  return { theta: theta + k * (r - p), b: b - 0.25 * k * (r - p) }
}

/** CEFR-ish label for θ so progress is readable. */
export function levelOf(theta: number) {
  const steps: [number, string][] = [[-1.2, 'A2'], [-0.4, 'B1'], [0.4, 'B2'], [1.2, 'C1'], [99, 'C2']]
  return steps.find(([t]) => theta < t)![1]
}
export const rating = (theta: number) => Math.round(1000 + theta * 200)

export type Difficulty = 'normal' | 'hard' | 'brutal'
// target for new verbs: about 75 % probability of success (together with reviews this gives roughly 80 % correct answers)
const TARGET: Record<Difficulty, number> = { normal: 0.75, hard: 0.64, brutal: 0.55 }

/** Choosing new verbs: closest to the target probability of success, with a little randomness. */
export function pickNewVerbs(theta: number, items: Record<string, MemState>, bOf: (id: string) => number, n: number, diff: Difficulty): Verb[] {
  const t = TARGET[diff]
  const ranked = VERBS.filter((v) => !items['v:' + v.id]?.reps)
    .map((v) => ({ v, s: Math.abs(pSuccess(theta, bOf(v.id)) - t) + Math.random() * 0.06 }))
    .sort((a, b) => a.s - b.s)
    .slice(0, n * 3)
  // interleaving: a group should mix patterns (AAA, ABB, ABC …), because telling similar forms apart builds knowledge better than blocks of the same pattern
  const out: Verb[] = []
  const used: Record<string, number> = {}
  while (out.length < n && ranked.length) {
    let bi = 0, best = Infinity
    ranked.forEach((x, i) => { const sc = x.s + (used[x.v.type] || 0) * 0.08; if (sc < best) { best = sc; bi = i } })
    const [x] = ranked.splice(bi, 1)
    out.push(x.v)
    used[x.v.type] = (used[x.v.type] || 0) + 1
  }
  return out
}

/** Placement test: 14 verbs ordered by difficulty from easier to harder. */
export function placementVerbs(bOf: (id: string) => number): Verb[] {
  const sorted = VERBS.slice().sort((a, b) => bOf(a.id) - bOf(b.id))
  const out: Verb[] = []
  const n = 14
  for (let i = 0; i < n; i++) {
    const pos = Math.floor(((i + 0.5) / n) * sorted.length)
    out.push(sorted[Math.min(sorted.length - 1, pos + Math.floor(Math.random() * 5) - 2)])
  }
  return [...new Set(out)]
}

export type VerbTask = 'forms' | 'inf' | 'reverse' | 'context' | 'hunt' | 'listen' | 'si' | 'fix' | 'odd' | 'pick' | 'build' | 'dictate' | 'match'

/** Session flow: −1 = it is not going well right now (easier, supported tasks), 0 = normal, +1 = going great (harder types).
 *  Set by the session from the latest answers; affects all following type choices. */
let FLOW: -1 | 0 | 1 = 0
export const setFlow = (f: -1 | 0 | 1) => { FLOW = f }
export const getFlow = () => FLOW

const EASY = new Set<VerbTask>(['forms', 'inf', 'pick', 'build', 'match'])

/** Task type by memory stability, difficulty level and session flow (“desirable difficulty”):
 *  new and weak verbs get recognition and supported recall, mastered ones get recall in a sentence, dictation and spotting mistakes. */
export function pickTask(c: MemState | undefined, diff: Difficulty, hasSentence: boolean, canListen: boolean, flow: -1 | 0 | 1 = FLOW): VerbTask {
  const S = c?.reps ? c.S : 0
  const r = Math.random()
  if (!c?.reps) {
    if (flow === 1 || diff !== 'normal') return r < 0.72 ? 'forms' : 'reverse'
    return 'forms'
  }
  const hs = hasSentence ? 1 : 0
  const pool: [VerbTask, number][] = [
    ['forms', 3],
    ['inf', S < 3 ? 2 : 0.6],
    ['reverse', S >= 1 ? 2 : 0.5],
    ['context', hs * (S >= 2 ? 3 : 1)],
    ['hunt', S >= 4 ? 1.5 : 0],
    ['listen', canListen && S >= 3 ? 1 : 0],
    ['pick', hs * (S < 3 ? 1.5 : 0.4)],
    ['fix', hs * (S >= 3 ? 2 : 0)],
    ['odd', S >= 2 ? 0.8 : 0],
    // new types: build the sentence (recognition + word order), match pairs (fast, fun), dictation (listening + spelling)
    ['build', hs * (S < 6 ? 2 : 0.8)],
    ['match', S >= 0.5 ? 1.3 : 0],
    ['dictate', canListen && hasSentence && S >= 2 ? 1.6 : 0],
  ]
  const hardMul = diff === 'brutal' ? 1.8 : diff === 'hard' ? 1.4 : 1
  const easyMul = diff === 'brutal' ? 0.55 : diff === 'hard' ? 0.75 : 1
  const fHard = flow === 1 ? 2 : flow === -1 ? 0.35 : 1
  const fEasy = flow === 1 ? 0.5 : flow === -1 ? 2 : 1
  pool.forEach((p) => { p[1] *= EASY.has(p[0]) ? easyMul * fEasy : hardMul * fHard })
  const total = pool.reduce((a, p) => a + p[1], 0)
  let x = r * total
  for (const [t, w] of pool) { x -= w; if (x <= 0) return t }
  return 'forms'
}

// ───────── fake forms for “spot the mistake” ─────────
function regular(v: string) {
  if (v.endsWith('e')) return v + 'd'
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied'
  const n = v.length
  if (n >= 3 && (v.match(/[aeiou]+/g) || []).length === 1 && !/[aeiou]/.test(v[n - 1]) && /[aeiou]/.test(v[n - 2]) && !/[aeiou]/.test(v[n - 3]) && !/[wxy]/.test(v[n - 1])) return v + v[n - 1] + 'ed'
  return v + 'ed'
}
const VOWEL_SWAPS: [RegExp, string][] = [[/i(n[gk])$/, 'a$1'], [/i(n[gk])$/, 'u$1'], [/ee/, 'e'], [/ea/, 'o'], [/i/, 'a'], [/ow$/, 'ew'], [/ear$/, 'ore']]

/** Returns a convincing wrong form (must not be accepted). */
export function fakeForm(v: Verb, f: 'past' | 'pp'): string {
  const ok = v.accept[f]
  const cands: string[] = []
  cands.push(regular(v.id))
  const other = f === 'past' ? v.shown.pp[0] : v.shown.past[0]
  cands.push(other)
  if (f === 'pp' && !v.shown.pp[0].endsWith('en')) cands.push(v.shown.past[0] + 'en')
  if (f === 'pp' && v.shown.pp[0].endsWith('en')) cands.push(v.shown.pp[0].slice(0, -2))
  for (const [re, rep] of VOWEL_SWAPS) if (re.test(v.id)) cands.push(v.id.replace(re, rep))
  const good = cands.filter((c) => c && !ok.has(c) && c !== v.id)
  return good.length ? good[Math.floor(Math.random() * good.length)] : regular(v.id) + 'd'
}
