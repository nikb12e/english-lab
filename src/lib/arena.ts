// Live arena: players who press “Play” in the same 10 second window land in the same room (Supabase Realtime, hosted version only).
// Questions and opponents are set by the room seed, so all devices compute them the same way; only answers travel over the network.
// Each question has its own time (based on type and text length); when everyone has answered, the game moves on at once.
import { VERBS, type Verb } from './verbs'
import { PRIOR, pSuccess } from './adaptive'
import { TEST_BANK } from '../data/testBank'
import { PICS } from '../data/pictures'
import { picDiff } from '../data/picBank'
import { SENTENCES, type Sentence } from '../data/sentences'
import { SENTENCES_AI } from '../data/sentencesAi'
import { BOT_NAMES, hash, rng } from './bots'

export const LOBBY_MS = 10_000
export const REVEAL_MS = 3_600
export const LAST_REVEAL_MS = 4_200
export const EARLY_PAUSE_MS = 700 // when everyone has answered, a short pause before the reveal
export const N_Q = 8
export const ROOM_SIZE = 6

/* ───────── shared clock (offset relative to the server) ───────── */
let offset = 0
export async function syncClock() {
  try {
    const t0 = Date.now()
    const r = await fetch('/?t=' + t0, { method: 'HEAD', cache: 'no-store' })
    const t1 = Date.now()
    const d = r.headers.get('date')
    if (d) offset = new Date(d).getTime() + 500 - (t0 + t1) / 2
  } catch { offset = 0 }
}
export const now = () => Date.now() + offset

/** The room you join now: the window closes at the end of the current 10 s (if less than 3 s are left, the next one). */
export function nextSlot(t = now()) {
  let slot = Math.floor(t / LOBBY_MS) + 1
  if (slot * LOBBY_MS - t < 3000) slot++
  return { slot, start: slot * LOBBY_MS + 800 }
}

/* ───────── questions ───────── */
export type AKind = 'choice' | 'tf' | 'type' | 'listen' | 'translate'
export interface AQ {
  kind: AKind
  label: string // task type shown to the player
  q: string
  sub?: string
  options: string[] // when typing: the correct answer and typical mistakes (only for Jev and the opponents)
  correct: number
  accept?: string[] // when typing: all accepted answers
  verbInput?: boolean // typing a verb form (strict comparison of forms)
  b: number
  vid?: string // verb for pronunciation (in listening it plays at the start)
  limit: number // time to answer in ms
  img?: string // illustration (What is in the picture?)
}
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)]
function shuffleR<T>(r: () => number, a: T[]) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/** Time for a question: a base by type + reading time (long questions get much more). */
const BASE: Record<AKind, number> = { choice: 6000, translate: 6000, tf: 7000, listen: 9500, type: 11000 }
function limitFor(kind: AKind, q: string, sub: string | undefined, options: string[]) {
  const chars = q.length + (sub?.length || 0) + (kind === 'type' ? 0 : options.join(' ').length)
  const ms = BASE[kind] + Math.min(13000, chars * 42)
  return Math.max(7000, Math.min(26000, Math.round(ms / 500) * 500))
}
function mk(q: Omit<AQ, 'limit'>): AQ { return { ...q, limit: limitFor(q.kind, q.q, q.sub, q.options) } }

const easyVerbs = VERBS.filter((v) => v.tier <= 3)
function wrongForms(v: Verb, form: 'past' | 'pp') {
  const right = v.shown[form][0]
  const cands = [form === 'pp' ? v.shown.past[0] : v.shown.pp[0], v.shown.inf[0], v.shown.inf[0].replace(/e$/, '') + 'ed', v.shown.inf[0] + 's', v.shown.inf[0].replace(/e$/, '') + 'en']
  return [...new Set(cands)].filter((w) => w && w !== right && !v.accept[form].has(w))
}
const formName = (f: 'past' | 'pp') => (f === 'pp' ? 'past participle' : 'past simple')

/** Choose the verb form (4 options). */
function verbQ(r: () => number): AQ | null {
  const v = pick(r, easyVerbs)
  const form = r() < 0.5 ? 'past' : 'pp'
  const right = v.shown[form][0]
  const wrong = wrongForms(v, form)
  if (wrong.length < 3) return null
  const opts = shuffleR(r, [right, ...shuffleR(r, wrong).slice(0, 3)])
  return mk({ kind: 'choice', label: 'Verb form', q: form === 'pp' ? 'Past participle' : 'Past simple', sub: `${v.shown.inf[0]} · ${v.slo}`, options: opts, correct: opts.indexOf(right), b: PRIOR[v.id] ?? 0, vid: v.id })
}

/** Type the verb form (harder: no options). */
function typeVerbQ(r: () => number): AQ | null {
  const v = pick(r, easyVerbs)
  const form = r() < 0.5 ? 'past' : 'pp'
  const wrong = wrongForms(v, form)
  if (!wrong.length) return null
  return mk({ kind: 'type', label: 'Type the form', q: `Write ${formName(form)}`, sub: `${v.shown.inf[0]} · ${v.slo}`, options: [v.shown[form][0], ...wrong.slice(0, 3)], correct: 0, accept: [...v.accept[form]], verbInput: true, b: (PRIOR[v.id] ?? 0) + 0.5, vid: v.id })
}

/** True or false: a sentence with a (wrong or) correct verb form. */
const ALL_S: Sentence[] = [...SENTENCES, ...SENTENCES_AI]
function tfQ(r: () => number): AQ | null {
  for (let g = 0; g < 8; g++) {
    const s = pick(r, ALL_S)
    const v = easyVerbs.find((x) => x.id === s[0]) || VERBS.find((x) => x.id === s[0])
    if (!v || s[2].length > 140) continue
    const form = s[1]
    const good = r() < 0.5
    const wrong = wrongForms(v, form).filter((w) => w !== v.shown.inf[0] || r() < 0.3)
    if (!good && !wrong.length) continue
    const filled = s[2].replace('___', good ? v.shown[form][0] : pick(r, wrong))
    const options = ['Correct', 'Wrong']
    return mk({ kind: 'tf', label: 'Right or wrong', q: filled, sub: 'Is the verb in the right form?', options, correct: good ? 0 : 1, b: (PRIOR[v.id] ?? 0) - 0.2, vid: v.id })
  }
  return null
}

/** Listen: a verb form plays (infinitive, past simple, past participle), choose the correctly spelled form. */
function misspell(r: () => number, w: string): string {
  const ops = [
    () => { const i = 1 + Math.floor(r() * (w.length - 2)); return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) }, // substitution
    () => { const i = 1 + Math.floor(r() * (w.length - 1)); return w.slice(0, i) + w.slice(i + 1) }, // omission
    () => { const i = Math.floor(r() * w.length); return w.slice(0, i + 1) + w[i] + w.slice(i + 1) }, // podvojitev
    () => w.replace(/ough|augh|ought|aught/, (m) => (m.startsWith('ou') ? m.replace('ou', 'au') : m.replace('au', 'ou'))),
    () => w.replace(/gh/, 'g').replace(/ea/, 'e').replace(/ew/, 'ue'),
    () => w.replace(/([aeiou])/, (m) => ({ a: 'e', e: 'a', i: 'e', o: 'u', u: 'o' } as Record<string, string>)[m]),
  ]
  return pick(r, ops)()
}
function listenQ(r: () => number): AQ | null {
  for (let g = 0; g < 6; g++) {
    const v = pick(r, easyVerbs.filter((x) => x.shown.past[0].length >= 4 || x.shown.pp[0].length >= 4))
    const form = v.shown.pp[0].length >= 4 && r() < 0.5 ? 'pp' : 'past'
    const right = v.shown[form][0]
    if (right.length < 4) continue
    const bad = new Set<string>()
    for (let k = 0; k < 20 && bad.size < 3; k++) { const m = misspell(r, right); if (m !== right && /^[a-z]+$/.test(m) && !v.accept[form].has(m)) bad.add(m) }
    if (bad.size < 3) continue
    const opts = shuffleR(r, [right, ...bad])
    return mk({ kind: 'listen', label: 'Listen and choose', q: `How is it spelled: ${formName(form)}?`, sub: 'Listen to the verb', options: opts, correct: opts.indexOf(right), b: (PRIOR[v.id] ?? 0) + 0.3, vid: v.id })
  }
  return null
}

/** Translate: a Slovenian word, choose the English one (clothes, materials, patterns). */
function translateQ(r: () => number): AQ | null {
  const cards = (TEST_BANK['v_clothes']?.cards || []).filter((c) => c.kind === 'type' && /Slovene word (.+?) into English/.test(c.q))
  if (cards.length < 4) return null
  const c = pick(r, cards)
  if (c.kind !== 'type') return null
  const word = c.q.match(/Slovene word (.+?) into English/)![1]
  const right = c.a[0]
  const others = shuffleR(r, cards.filter((x) => x.kind === 'type' && x.a[0] !== right).map((x) => (x.kind === 'type' ? x.a[0] : ''))).slice(0, 3)
  const opts = shuffleR(r, [right, ...others])
  return mk({ kind: 'translate', label: 'Translate', q: word, sub: 'How do you say it in English?', options: opts, correct: opts.indexOf(right), b: -0.2 })
}

/** What is in the picture: an illustration of a word from the worksheets, four options from the same group. */
function picQ(r: () => number): AQ | null {
  const p = pick(r, PICS)
  const others = shuffleR(r, PICS.filter((x) => x.cat === p.cat && x.id !== p.id)).slice(0, 3).map((x) => x.en[0])
  if (others.length < 3) return null
  const opts = shuffleR(r, [p.en[0], ...others])
  const lvl = picDiff(p)
  return mk({ kind: 'choice', label: 'What is in the picture?', q: '', options: opts, correct: opts.indexOf(p.en[0]), b: -0.9 + lvl * 0.5, img: p.id })
}

/** Multiple choice tasks from the test (articles, vocabulary, idioms, state verbs). */
const CARD_SECS = ['a_test', 'v_conf', 'p_state', 'v_explain_idiom', 'v_odd', 'v_announce', 'v_holiday', 'v_idiom', 'v_appear']
const SEC_LABEL: Record<string, string> = { a_test: 'Article', v_conf: 'The right word', p_state: 'Present Simple / Continuous', v_explain_idiom: 'Meaning of the idiom', v_odd: 'Odd one out', v_announce: 'Announcements', v_holiday: 'Holidays', v_idiom: 'Idiom', v_appear: 'Appearance and personality' }
function cardQ(r: () => number): AQ | null {
  const secs = CARD_SECS.filter((s) => TEST_BANK[s])
  for (let g = 0; g < 6; g++) {
    const sec = pick(r, secs)
    const cards = TEST_BANK[sec].cards.filter((c) => c.kind === 'choice' && c.options.length >= 2 && c.options.length <= 4 && c.q.length <= 220 && c.options.every((o) => o.length <= 70))
    if (!cards.length) continue
    const c = pick(r, cards)
    if (c.kind !== 'choice') continue
    const order = shuffleR(r, c.options.map((_, i) => i))
    return mk({ kind: 'choice', label: SEC_LABEL[sec] || 'Task from the test', q: c.q, options: order.map((i) => c.options[i]), correct: order.indexOf(c.correct), b: sec === 'a_test' ? 0.35 : 0.15 })
  }
  return null
}

/** Short typed answer from the test (opposites, -ing forms): a one word answer. */
function typeCardQ(r: () => number): AQ | null {
  for (const sec of shuffleR(r, ['v_opp', 'p_spell'])) {
    const cards = (TEST_BANK[sec]?.cards || []).filter((c) => c.kind === 'type' && c.a.length && c.a[0].length <= 16 && c.q.length <= 90)
    if (!cards.length) continue
    const c = pick(r, cards)
    if (c.kind !== 'type') continue
    return mk({ kind: 'type', label: sec === 'v_opp' ? 'Write the opposite' : 'Type the form', q: c.q, options: [c.a[0], c.a[0] + 's', 'un' + c.a[0]].filter((x, i, a) => a.indexOf(x) === i), correct: 0, accept: c.a, b: 0.2 })
  }
  return null
}

/** Questions for the room: a varied mix of types; the same on all devices. */
const PLAN: (() => (r: () => number) => AQ | null)[] = [
  () => verbQ, () => cardQ, () => tfQ, () => listenQ, () => picQ, () => typeVerbQ, () => translateQ, () => typeCardQ, () => cardQ, () => picQ, () => tfQ,
]
export function roomQuestions(slot: number): AQ[] {
  const r = rng(hash('arena-q3-' + slot))
  const order = shuffleR(r, PLAN.map((_, i) => i)).slice(0, N_Q)
  const out: AQ[] = []
  const used = new Set<string>()
  for (const idx of order) {
    for (let g = 0; g < 4; g++) {
      const q = PLAN[idx]()(r) || verbQ(r)
      if (!q || used.has(q.q + q.sub + (q.img || ''))) continue
      used.add(q.q + q.sub + (q.img || ''))
      out.push(q)
      break
    }
  }
  while (out.length < N_Q) { const q = verbQ(r); if (q && !used.has(q.q + q.sub)) { used.add(q.q + q.sub); out.push(q) } }
  return out
}

/* ───────── points (like Kahoot: correct and fast, relative to the question time) ───────── */
export function points(ok: boolean, ms: number, streak: number, limit: number) {
  if (!ok) return 0
  const t = Math.max(0, Math.min(1, ms / limit))
  return Math.round(1000 * (1 - t / 2)) + Math.min(3, Math.max(0, streak - 1)) * 100
}

/* ───────── timeline: each question has its own time, instant end when everyone has answered ───────── */
export interface Slot { start: number; end: number; revEnd: number }
/** Computes the starts and ends of questions. allMs(i) returns the longest answer time if EVERYONE answered, otherwise null.
 *  Because the reported answer times are used (not the moment of receipt), the timeline is the same on all devices. */
export function timeline(start: number, qs: AQ[], allMs: (i: number) => number | null): Slot[] {
  const out: Slot[] = []
  let s = start
  qs.forEach((q, i) => {
    const m = allMs(i)
    const end = s + (m == null ? q.limit : Math.min(q.limit, m + EARLY_PAUSE_MS))
    const revEnd = end + (i === qs.length - 1 ? LAST_REVEAL_MS : REVEAL_MS)
    out.push({ start: s, end, revEnd })
    s = revEnd
  })
  return out
}

/* ───────── opponents in the room ───────── */
export interface Player { id: string; name: string; theta: number; bot?: boolean; joinAt?: number }

/** Adapting: if you play alone with bots and often win, the bots get stronger; if you are often last, weaker. */
export function arenaAdjust(): number {
  try {
    const places: number[] = JSON.parse(localStorage.getItem('el:arena') || '[]')
    if (places.length < 2) return 0
    const avg = places.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, places.length)
    return avg <= 1.6 ? 0.45 : avg <= 2.4 ? 0.2 : avg >= 4.6 ? -0.5 : avg >= 3.6 ? -0.25 : 0
  } catch { return 0 }
}
export function rememberPlace(place: number) {
  try {
    const p: number[] = JSON.parse(localStorage.getItem('el:arena') || '[]')
    localStorage.setItem('el:arena', JSON.stringify([...p, place].slice(-12)))
  } catch { /* */ }
}

/** Fills the room with bots up to ROOM_SIZE. Bot strength is around the average of the people in the room, with a spread (one is always beatable). */
export function fillBots(slot: number, humans: Player[], adjust: number): Player[] {
  const need = Math.max(0, ROOM_SIZE - humans.length)
  const r = rng(hash('arena-bots-' + slot))
  const mean = humans.length ? humans.reduce((a, h) => a + h.theta, 0) / humans.length : 0
  const names = shuffleR(r, BOT_NAMES.filter((n) => !humans.some((h) => h.name.toLowerCase() === n.toLowerCase())))
  const spread = [-1.0, -0.6, -0.3, 0, 0.25, 0.5]
  const offs = shuffleR(r, spread).slice(0, need)
  return offs.map((o, i) => ({ id: `bot:${slot}:${i}`, name: names[i], theta: mean + o + (humans.length === 1 ? adjust : 0), bot: true, joinAt: 0.15 + r() * 0.75 }))
}

/** Jev's decisions for the room: p[i] = probability that a learner picks each answer; d[i] = difficulty from 0 (very easy) to 4 (very hard). */
export interface JevRoom { p: number[][]; d: number[] }
export async function fetchJevRoom(slot: number, qs: AQ[]): Promise<JevRoom | null> {
  try {
    const { supabase } = await import('./supabase')
    const res = await Promise.race([
      supabase.functions.invoke('ai', { body: { action: 'arena', slot, qs: qs.map((q) => ({ q: q.img ? `Picture naming: the student sees a drawing of "${q.options[q.correct]}" and must pick its English name` : q.kind === 'type' ? `${q.q} (the student must type the answer, no options shown)` : q.q, sub: q.sub, options: q.options })) } }),
      new Promise<null>((r) => setTimeout(() => r(null), 6000)),
    ])
    const d = res && !res.error ? (res.data as JevRoom) : null
    return d && Array.isArray(d.p) && Array.isArray(d.d) ? d : null
  } catch { return null }
}

/** A bot's answer to question i. With Jev: Jev sets the difficulty and wrong answers follow what a learner would realistically choose.
 *  Answer time is proportional to the question time (long questions take longer to read), listening adds the length of the recording. */
export function botAnswer(slot: number, bot: Player, i: number, q: AQ, jv?: JevRoom | null): { choice: number; ms: number } {
  const r = rng(hash(`arena-a2-${slot}-${bot.id}-${i}`))
  const jp = jv?.p?.[i]
  const jd = jv?.d?.[i]
  const b = (typeof jd === 'number' ? -1.4 + jd * 0.75 : q.b) + (q.kind === 'type' ? 0.4 : 0)
  const ease = q.kind === 'tf' ? 0.8 : q.kind === 'type' ? 0 : 0.4 // choosing is easier than typing, true/false even easier
  const p = Math.min(0.96, Math.max(0.1, pSuccess(bot.theta + ease, b)))
  const ok = r() < p
  const speed = Math.max(0, Math.min(1, (bot.theta + 1.5) / 3.5))
  const frac = 0.16 + (1 - speed) * 0.3 + r() * 0.28 + (typeof jd === 'number' ? jd * 0.03 : 0.04) + (ok ? 0 : r() * 0.1)
  const ms = Math.round(Math.min(q.limit - 400, q.limit * frac + (q.kind === 'listen' ? 1800 : 0)))
  let choice = q.correct
  if (!ok) {
    const others = q.options.map((_, k) => k).filter((k) => k !== q.correct)
    const w = others.map((k) => (jp && jp.length === q.options.length ? Math.max(0, jp[k]) : 0) + 0.05)
    let x = r() * w.reduce((a, c) => a + c, 0)
    choice = others[others.length - 1]
    for (let n = 0; n < others.length; n++) { x -= w[n]; if (x <= 0) { choice = others[n]; break } }
  }
  return { choice, ms }
}
