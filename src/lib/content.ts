import type { Card, Deck, TopicId } from '../data/types'
import { GRAMMAR } from '../data/grammar'
import { SENTENCES, type Sentence } from '../data/sentences'
import { SENTENCES_AI } from '../data/sentencesAi'
import { VERBS, VERB_BY_ID, type Verb } from './verbs'
import { TEST_VERBS } from '../data/verbs'
import { retrievability, runOf, type MemState } from './fsrs'
import { getState, type Settings, type Profile } from './store'
import { PRIOR, pickNewVerbs, pickTask, placementVerbs, pSuccess, getFlow, type VerbTask, type Difficulty } from './adaptive'
import { BANK_DIFF } from '../data/bankDiff'
import { canSpeak } from './speech'

export const DECK_BY_ID: Record<string, Deck> = Object.fromEntries(GRAMMAR.map((d) => [d.id, d]))
export { GRAMMAR }

export const SENTENCES_BY_VERB: Record<string, Sentence[]> = {}
const sentKey = (s: Sentence) => s[2].toLowerCase().replace(/\s+/g, ' ')
const known = new Set<string>()
export function addSentences(list: Sentence[]) {
  for (const s of list) {
    if (!VERB_BY_ID[s[0]] || known.has(sentKey(s))) continue
    known.add(sentKey(s))
    ;(SENTENCES_BY_VERB[s[0]] ||= []).push(s)
  }
}
addSentences([...SENTENCES, ...SENTENCES_AI])
// extra sentences the language model created during use
try { addSentences(JSON.parse(localStorage.getItem('el:aiS') || '[]')) } catch { /* */ }

const SEEN_KEY = 'el:sSeen'
let sentSeen: Record<string, number> = {}
try { sentSeen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { sentSeen = {} }

/** Picks the sentence the user has not seen for the longest time; when a verb runs out, new ones are requested in the background. */
export function pickSentence(id: string): Sentence {
  const l = SENTENCES_BY_VERB[id]
  const sorted = l.slice().sort((a, b) => (sentSeen[sentKey(a)] || 0) - (sentSeen[sentKey(b)] || 0) || Math.random() - 0.5)
  const s = sorted[0]
  sentSeen[sentKey(s)] = Date.now()
  const ks = Object.keys(sentSeen)
  if (ks.length > 3000) ks.sort((a, b) => sentSeen[a] - sentSeen[b]).slice(0, 500).forEach((k) => delete sentSeen[k])
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(sentSeen)) } catch { /* */ }
  const unseen = l.filter((x) => !sentSeen[sentKey(x)]).length
  if (unseen < 2) void topUp(id, s[1])
  return s
}

// the sentence for each task in a session is chosen once, so the voice can prepare it one task ahead
const chosen = new Map<number, Sentence>()
export function sentFor(uid: number, id: string): Sentence {
  let s = chosen.get(uid)
  if (!s || !SENTENCES_BY_VERB[id]?.includes(s)) { s = pickSentence(id); chosen.set(uid, s) }
  if (chosen.size > 200) chosen.delete(chosen.keys().next().value as number)
  return s
}

const asking = new Set<string>()
async function topUp(id: string, form: Sentence[1]) {
  const v = VERB_BY_ID[id]
  if (!v || asking.has(id + form)) return
  asking.add(id + form)
  try {
    const { aiOn, genSentences } = await import('./ai')
    if (!aiOn()) return
    const exclude = (SENTENCES_BY_VERB[id] || []).filter((x) => x[1] === form).map((x) => x[2])
    const got = await genSentences(id, form, v.slo, [...v.accept[form]], exclude)
    const items: Sentence[] = got.map((x) => [id, form, x.en, x.sl] as Sentence)
    if (!items.length) return
    addSentences(items)
    const stored: Sentence[] = JSON.parse(localStorage.getItem('el:aiS') || '[]')
    localStorage.setItem('el:aiS', JSON.stringify([...stored, ...items].slice(-800)))
  } catch { /* offline: the existing sentences remain */ }
}

export type QItem =
  | { kind: 'verb'; key: string; verb: Verb; task: VerbTask; placement?: boolean }
  | { kind: 'card'; key: string; deck: Deck; card: Card }

/** Automatic difficulty (no setting needed): from the accuracy of the last 14 days.
 *  Recall research recommends about 80 % success; if it goes better than 88 %, new verbs come from the edge of your knowledge. */
export function effDiff(p: Profile = getState().profile): Difficulty {
  let n = 0, c = 0
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    n += p.days[k]?.n || 0; c += p.days[k]?.c || 0
  }
  // automatic level: a very reliable learner gets the hardest tasks, a reliable one harder ones, otherwise normal
  if (n >= 80 && c / n >= 0.95) return 'brutal'
  return n >= 30 && c / n >= 0.88 ? 'hard' : 'normal'
}

export const bOf = (profile: Profile) => (id: string) => PRIOR[id] + (profile.bAdj[id] || 0)

export const today = (d = new Date()) => d.toLocaleDateString('sv-SE')
export const dayOffset = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function verbItem(v: Verb, task: VerbTask, items: Record<string, MemState>, settings: Settings): QItem {
  const key = (task === 'si' ? 'vs:' : 'v:') + v.id
  let t = task
  if ((t === 'context' || t === 'build' || t === 'pick' || t === 'fix') && !SENTENCES_BY_VERB[v.id]) t = 'forms'
  if ((t === 'listen' || t === 'dictate') && (!canSpeak() || !getState().session)) t = t === 'dictate' && SENTENCES_BY_VERB[v.id] ? 'context' : 'forms'
  void items; void settings
  return { kind: 'verb', key, verb: v, task: t }
}

/** Automatic task type for a verb based on memory. */
export function autoVerbItem(v: Verb, items: Record<string, MemState>, settings: Settings): QItem {
  const c = items['v:' + v.id]
  // only for tests on a local server: force a task type
  try { const f = location.hostname === 'localhost' && localStorage.getItem('el:forceTask'); if (f) return verbItem(v, f as VerbTask, items, settings) } catch { /* */ }
  const task: VerbTask =
    settings.verbMode === 'inf' && !c?.reps ? 'inf' : pickTask(c, effDiff(), !!SENTENCES_BY_VERB[v.id], canSpeak() && settings.speech && !!getState().session)
  return verbItem(v, task, items, settings)
}

export function itemFromKey(key: string, items: Record<string, MemState>, settings: Settings): QItem | null {
  if (key.startsWith('vs:')) {
    const v = VERB_BY_ID[key.slice(3)]
    return v ? verbItem(v, 'si', items, settings) : null
  }
  if (key.startsWith('v:')) {
    const v = VERB_BY_ID[key.slice(2)]
    return v ? autoVerbItem(v, items, settings) : null
  }
  if (key.startsWith('c:')) {
    const [deckId, cardId] = key.slice(2).split('/')
    const deck = DECK_BY_ID[deckId]
    const card = deck?.cards.find((c) => c.id === cardId)
    return deck && card ? { kind: 'card', key, deck, card } : null
  }
  return null
}

export const topicOfKey = (key: string): TopicId | null =>
  key.startsWith('v') ? 'verbs' : key.startsWith('c:') ? ((key.slice(2).split('/')[0] as TopicId) in DECK_BY_ID ? (key.slice(2).split('/')[0] as TopicId) : null) : null

export function dueKeys(items: Record<string, MemState>, topics: TopicId[], now = Date.now()) {
  return Object.entries(items)
    .filter(([k, s]) => s.reps && s.due <= now && topics.includes(topicOfKey(k) as TopicId))
    .sort((a, b) => retrievability(a[1], now) - retrievability(b[1], now))
    .map(([k]) => k)
}

/** A mastered verb: correct at least twice in a row (or correct on the first encounter). */
export const UTRJEN = 2
/** Started but not yet mastered verbs (asked at least once, run of correct answers < 2). */
export const openVerbKeys = (items: Record<string, MemState>) =>
  VERBS.map((v) => 'v:' + v.id).filter((k) => items[k]?.reps && runOf(items[k]) < UTRJEN)
/** Size of a group of new verbs. */
export const verbBatch = (s: Settings) => Math.max(1, Math.min(10, s.verbBatch || 5))
/** New verbs come only when all started verbs are mastered; then one group comes. */
export const newVerbsLeft = (s: Settings, _p?: Profile, items?: Record<string, MemState>) =>
  items && openVerbKeys(items).length ? 0 : verbBatch(s)
export const newCardsLeft = (s: Settings, _p?: Profile) => s.newCards

export function unseenCards(items: Record<string, MemState>, topics: TopicId[]): QItem[] {
  const decks = GRAMMAR.filter((d) => topics.includes(d.id))
  // random order: task types are mixed, so every session looks different
  const lists = decks.map((d) => shuffle(d.cards.filter((c) => c.kind !== 'write' && !items[`c:${d.id}/${c.id}`]?.reps)).map((c) => ({ kind: 'card' as const, key: `c:${d.id}/${c.id}`, deck: d, card: c })))
  const out: QItem[] = []
  for (let i = 0; lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}

function interleave<T>(a: T[], b: T[]): T[] {
  if (!a.length) return b.slice()
  if (!b.length) return a.slice()
  const out: T[] = []
  const step = Math.max(1, Math.floor(a.length / b.length))
  let bi = 0
  a.forEach((x, i) => {
    out.push(x)
    if ((i + 1) % step === 0 && bi < b.length) out.push(b[bi++])
  })
  while (bi < b.length) out.push(b[bi++])
  return out
}

/** Smart training: due reviews (most forgotten first), new verbs at the edge of your knowledge, new grammar cards. */
export function buildSmart(items: Record<string, MemState>, settings: Settings, profile: Profile, topics: TopicId[]): QItem[] {
  const dk = dueKeys(items, topics).slice(0, 70)
  // unmastered verbs come into practice even if the schedule says they are not due yet: you master them first
  const open = topics.includes('verbs') ? openVerbKeys(items).filter((k) => !dk.includes(k)) : []
  const due = [...open, ...dk].map((k) => itemFromKey(k, items, settings)).filter(Boolean) as QItem[]
  const nv = topics.includes('verbs')
    ? pickNewVerbs(profile.theta, items, bOf(profile), newVerbsLeft(settings, profile, items), effDiff(profile)).map((v) => autoVerbItem(v, items, settings))
    : []
  const grammarTopics = topics.filter((t) => t !== 'verbs')
  const nc = grammarTopics.length ? unseenCards(items, grammarTopics).slice(0, newCardsLeft(settings, profile)) : []
  const fresh = interleave(shuffle(nv), nc)
  const rev = shuffle(due.slice(0, 10)).concat(due.slice(10))
  const base = interleave(rev, fresh)
  // focus on weak points: a few tasks from the categories where you make the most mistakes, spread through the training
  const focus = focusFor(items, settings, profile, topics, new Set(base.map((q) => q.key)))
  return separateSameVerb(interleave(base, focus))
}

/** The same word must not come twice in a row. */
function separateSameVerb(q: QItem[]): QItem[] {
  for (let i = 1; i < q.length; i++) {
    if (q[i].kind === 'verb' && q[i - 1].kind === 'verb' && (q[i] as any).verb.id === (q[i - 1] as any).verb.id) {
      const j = q.findIndex((x, k) => k > i + 1 && x.kind !== 'verb')
      if (j > 0) [q[i], q[j]] = [q[j], q[i]]
    }
  }
  return q
}

export function buildPlacement(profile: Profile, items: Record<string, MemState>, settings: Settings): QItem[] {
  return placementVerbs(bOf(profile)).map((v) => ({ ...verbItem(v, 'forms', items, settings), placement: true }) as QItem)
}

/** Practice of one task type for verbs. */
export function buildVerbDrill(task: VerbTask, items: Record<string, MemState>, settings: Settings, profile: Profile, n = 15): QItem[] {
  const now = Date.now()
  const seen = VERBS.filter((v) => items['v:' + v.id]?.reps)
  let pool: Verb[]
  if (task === 'context' || task === 'fix' || task === 'pick') {
    const withS = VERBS.filter((v) => SENTENCES_BY_VERB[v.id])
    const seenS = withS.filter((v) => items['v:' + v.id]?.reps)
    pool = seenS.length >= 10 ? seenS : withS
  } else if (task === 'si') {
    const due = VERBS.filter((v) => items['vs:' + v.id]?.reps && items['vs:' + v.id].due <= now)
    const fresh = pickNewVerbs(profile.theta, Object.fromEntries(Object.entries(items).filter(([k]) => k.startsWith('vs:')).map(([k, s]) => ['v:' + k.slice(3), s])), bOf(profile), n, effDiff(profile))
    pool = [...due, ...fresh]
  } else {
    pool = seen.length >= 12 ? seen : pickNewVerbs(profile.theta, items, bOf(profile), n, effDiff(profile)).concat(seen)
  }
  // weak and forgotten ones take priority
  pool = pool
    .map((v) => ({ v, w: (1 - retrievability(items['v:' + v.id], now)) + (items['v:' + v.id]?.lapses || 0) * 0.3 + Math.random() * 0.5 }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.v)
  return shuffle(pool.slice(0, n)).map((v) => verbItem(v, task, items, settings))
}

export function buildDeckDrill(topic: TopicId, items: Record<string, MemState>, settings: Settings, n = 15): QItem[] {
  const d = DECK_BY_ID[topic]
  const now = Date.now()
  const keys = d.cards.map((c) => `c:${d.id}/${c.id}`)
  const due = keys.filter((k) => items[k]?.reps && items[k].due <= now)
  const fresh = keys.filter((k) => !items[k]?.reps)
  let pick = [...due, ...fresh.slice(0, Math.max(5, n - due.length))]
  if (pick.length < 6) pick = pick.concat(shuffle(keys.filter((k) => !pick.includes(k))).slice(0, n - pick.length))
  return pick.slice(0, n).map((k) => itemFromKey(k, items, settings)!).filter(Boolean)
}

/** Everything together: a mix of everything that is due and a little new from every topic. */
export function buildEverything(items: Record<string, MemState>, settings: Settings, profile: Profile): QItem[] {
  return buildSmart(items, settings, profile, ['verbs', 'present', 'articles', 'nouns', 'vocab'])
}

// ───────── language model: fresh test tasks ─────────
import { freshItems, type GenItem } from './ai'
import { TEST_BANK } from '../data/testBank'

const AI_KEY = 'el:aiC'
const hashStr = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }
const secTopic = (sec: string): TopicId | null => TEST_BANK[sec]?.topic || null
/** sections without live generation (the pictures are hand drawn) */
export const NO_AI = new Set(['v_pic'])
function toCard(sec: string, g: GenItem): Card | null {
  const id = `ai_${sec}_${hashStr(g.q)}`
  // diff: difficulty 1-5, rated when the task was created
  const diff = typeof g.diff === 'number' ? g.diff : undefined
  if (g.kind === 'choice' && g.options && typeof g.correct === 'number') return { id, kind: 'choice', q: g.q, options: g.options, correct: g.correct, note: g.note, sec, diff } as Card
  if (g.kind === 'type' && g.a?.length) return { id, kind: 'type', q: g.q, a: g.a, hint: g.hint, note: g.note, sec, diff } as Card
  return null
}
function addAiCards(list: { sec: string; card: Card }[]) {
  for (const { sec, card } of list) {
    const t = secTopic(sec)
    const d = t && DECK_BY_ID[t]
    if (d && !d.cards.some((c) => c.id === card.id)) d.cards.push(card)
  }
}
try { addAiCards(JSON.parse(localStorage.getItem(AI_KEY) || '[]')) } catch { /* */ }

/** When a group runs out of new tasks, the language model creates new, checked tasks (needs your own AI key). */
export async function topUpTests(items: Record<string, MemState>, max = 3, only?: string[]) {
  const secs = (only || Object.keys(TEST_BANK)).filter((sec) => TEST_BANK[sec] && !NO_AI.has(sec)).map((sec) => {
    const t = secTopic(sec)!
    const d = DECK_BY_ID[t]
    const unseen = d.cards.filter((c) => c.sec === sec && !items[`c:${t}/${c.id}`]?.reps).length
    return { sec, unseen }
  }).filter((x) => x.unseen < 5).sort((a, b) => a.unseen - b.unseen).slice(0, max)
  let added = 0
  for (const { sec } of secs) {
    const t = secTopic(sec)!
    const qs = DECK_BY_ID[t].cards.filter((c) => c.sec === sec).map((c) => c.q)
    const r = await freshItems(sec, qs)
    const cards = (r?.items || []).map((g) => toCard(sec, g)).filter(Boolean) as Card[]
    if (!cards.length) continue
    addAiCards(cards.map((card) => ({ sec, card })))
    added += cards.length
    try {
      const stored = JSON.parse(localStorage.getItem(AI_KEY) || '[]')
      localStorage.setItem(AI_KEY, JSON.stringify([...stored, ...cards.map((card) => ({ sec, card }))].slice(-1500)))
    } catch { /* */ }
  }
  return added
}

/** Check: tasks in the order and scope of the Mock test, picking weak and not yet seen tasks. */
export const MOCK_PLAN: [string, number][] = [['v_cross', 4], ['v_explain', 3], ['p_brackets', 5], ['p_dialog', 2], ['v_opp', 3], ['v_word', 5], ['a_test', 6], ['verbs', 6], ['p_state', 2], ['v_idiom', 2], ['v_form', 2], ['v_write', 1]]
export function buildMockTest(items: Record<string, MemState>, settings: Settings): QItem[] {
  const now = Date.now()
  const out: QItem[] = []
  for (const [sec, n] of MOCK_PLAN) {
    if (sec === 'verbs') {
      const pool = shuffle(VERBS.filter((v) => TEST_VERBS.has(v.id)))
        .map((v) => ({ v, w: (1 - retrievability(items['v:' + v.id], now)) + (items['v:' + v.id]?.lapses || 0) * 0.3 + Math.random() * 0.6 }))
        .sort((a, b) => b.w - a.w).slice(0, n)
      pool.forEach(({ v }, i) => out.push(verbItem(v, i % 3 === 0 ? 'fix' : i % 3 === 1 && SENTENCES_BY_VERB[v.id] ? 'context' : 'forms', items, settings)))
      continue
    }
    const t: TopicId = sec === 'v_explain' || sec === 'v_write' ? 'vocab' : secTopic(sec)!
    const d = DECK_BY_ID[t]
    const cards = d.cards.filter((c) => c.sec === sec)
    const scored = cards.map((c) => {
      const st = items[`c:${t}/${c.id}`]
      const w = !st?.reps ? 1 + Math.random() : (1 - retrievability(st, now)) + (st.lapses || 0) * 0.4 + Math.random() * 0.3
      return { c, w }
    }).sort((a, b) => b.w - a.w).slice(0, n)
    scored.forEach(({ c }) => out.push({ kind: 'card', key: `c:${t}/${c.id}`, deck: d, card: c }))
  }
  return out
}

export const SEC_NAME: Record<string, [string, string]> = {
  v_cross: ['From the definition', 'a description into one word'], v_explain: ['Explain in English', 'graded by the language model'], p_brackets: ['Present in brackets', 'simple or continuous'],
  p_state: ['State or action', 'think, have, see, weigh'], p_spell: ['-s and -ing spelling', 'hopping, lying, panicking'], v_opp: ['Opposites', 'dishonest, impatient'],
  v_word: ['One word', 'meaning in brackets'], a_test: ['Articles from the test', 'the Thames, in prison'], v_form: ['Word formation', 'ENJOY into enjoyable'],
  v_conf: ['Easily confused words', 'trip, journey, travel'], v_prep: ['Prepositions', 'on foot, off the beaten track'], v_phr: ['Phrasal verbs', 'set off, hold up'],
  v_idiom: ['Idioms', 'cold feet, see eye to eye'], v_clothes: ['Clothes', 'zip, checked, suede'], v_appear: ['Appearance and personality', 'stubble, fussy'],
  v_holiday: ['Holidays', 'half board, stopover'],
  p_dialog: ['Present in a dialogue', 'like the phone call on the sheet'], v_odd: ['Odd one out', 'calm, rough, open … sea'],
  v_noun: ['Guess the noun', 'sandy, secluded … beach'], v_reply: ['The right reply', 'replies to statements about travel'],
  v_announce: ['Announcements on the way', 'gate, platform, luggage'], v_explain_idiom: ['Meaning of idioms', 'dressed to kill, cold feet'],
  v_write: ['Writing', 'describing a person, holidays; graded by the AI teacher'],
  v_pic: ['Name the picture', '82 illustrations from the worksheets'],
}
/** Practice of one kind of test task: weak and not yet seen ones first. */
export function buildSecDrill(sec: string, items: Record<string, MemState>, n = 12): QItem[] {
  const t: TopicId = sec === 'v_explain' || sec === 'v_write' ? 'vocab' : TEST_BANK[sec].topic
  const d = DECK_BY_ID[t]
  const now = Date.now()
  return d.cards.filter((c) => c.sec === sec).map((c) => {
    const st = items[`c:${t}/${c.id}`]
    return { c, w: !st?.reps ? 1 + Math.random() : (1 - retrievability(st, now)) + (st.lapses || 0) * 0.4 + Math.random() * 0.4 }
  }).sort((a, b) => b.w - a.w).slice(0, n).map(({ c }) => ({ kind: 'card' as const, key: `c:${t}/${c.id}`, deck: d, card: c }))
}

// ───────── targeted: similar tasks and focus on weak points ─────────
import { weakest, isVerbCat, catsOf } from './weak'
import { family } from './verbs'

const cardKey = (t: TopicId, id: string) => `c:${t}/${id}`
function topicOfSec(sec: string): TopicId | null {
  if (sec === 'v_explain' || sec === 'v_write') return 'vocab'
  if (sec.startsWith('d:')) return sec.slice(2) as TopicId
  return TEST_BANK[sec]?.topic || null
}
// card difficulty (Jev): the share of tasks in the bank that are easier than this one, mapped onto the ability scale θ
const DIFF_SORTED = Object.values(BANK_DIFF).sort((a, b) => a - b)
export function cardB(c: Card): number | null {
  const raw = BANK_DIFF[c.id] ?? (typeof (c as { diff?: number }).diff === 'number' ? ((c as { diff?: number }).diff! - 1) * 0.75 : null)
  if (raw == null) return null
  let lo = 0, hi = DIFF_SORTED.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (DIFF_SORTED[m] < raw) lo = m + 1; else hi = m }
  return -1.3 + 2.6 * (lo / Math.max(1, DIFF_SORTED.length))
}
// target probability of success for new cards according to the session flow: easier when it is not going well, harder when it is going great
const CARD_TARGET = { '-1': 0.86, '0': 0.72, '1': 0.55 } as const

function cardsOfCat(cat: string, items: Record<string, MemState>, exclude: Set<string>, n: number): QItem[] {
  const t = topicOfSec(cat)
  if (!t) return []
  const d = DECK_BY_ID[t]
  const now = Date.now()
  const theta = getState().profile.theta || 0
  const target = CARD_TARGET[String(getFlow()) as '-1' | '0' | '1']
  return d.cards
    .filter((c) => (cat.startsWith('d:') ? !c.sec : c.sec === cat) && c.kind !== 'write' && !exclude.has(cardKey(t, c.id)))
    .map((c) => {
      const st = items[cardKey(t, c.id)]
      // new: closest to the target probability of success (difficulty rated by Jev); known: the ones you forget most or got wrong
      const b = cardB(c)
      const fit = b == null ? 0.5 : 1 - Math.min(1, Math.abs(pSuccess(theta, b) - target) * 2.2)
      const w = !st?.reps ? 1.2 + fit * 0.9 + Math.random() * 0.3 : (1 - retrievability(st, now)) + (st.lapses || 0) * 0.5 + Math.random() * 0.4
      return { c, w }
    })
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map(({ c }) => ({ kind: 'card' as const, key: cardKey(t, c.id), deck: d, card: c }))
}
function verbsOfCat(cat: string, items: Record<string, MemState>, settings: Settings, exclude: Set<string>, n: number): QItem[] {
  const now = Date.now()
  const [kind, val] = [cat.slice(0, 3), cat.slice(3)]
  let pool = VERBS.filter((v) => !exclude.has('v:' + v.id))
  if (kind === 'vp:') pool = pool.filter((v) => v.type === val)
  if (kind === 'vf:') pool = pool.filter((v) => v.fam === val)
  const started = pool.filter((v) => items['v:' + v.id]?.reps)
  if (started.length >= Math.min(n, 3)) pool = started
  const task = kind === 'vt:' ? (val as VerbTask) : null
  if (task && (task === 'context' || task === 'fix' || task === 'pick')) pool = pool.filter((v) => SENTENCES_BY_VERB[v.id])
  return pool
    .map((v) => ({ v, w: (1 - retrievability(items['v:' + v.id], now)) + (items['v:' + v.id]?.lapses || 0) * 0.4 + Math.random() * 0.5 }))
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map(({ v }) => (task ? verbItem(v, task, items, settings) : autoVerbItem(v, items, settings)))
}
export function itemsForCat(cat: string, items: Record<string, MemState>, settings: Settings, exclude: Set<string>, n: number): QItem[] {
  return isVerbCat(cat) ? verbsOfCat(cat, items, settings, exclude, n) : cardsOfCat(cat, items, exclude, n)
}

/** After a mistake: a similar task of the same kind (another card of the same group or a verb of the same family with the same task). */
export function similarTo(it: QItem, items: Record<string, MemState>, settings: Settings, exclude: Set<string>): QItem | null {
  if (it.kind === 'card') {
    if (it.card.kind === 'write') return null
    return cardsOfCat(it.card.sec || 'd:' + it.deck.id, items, exclude, 1)[0] || null
  }
  const v = it.verb
  const sibs = family(v).filter((x) => !exclude.has('v:' + x.id))
  const same = sibs.length ? sibs : VERBS.filter((x) => x.type === v.type && x.id !== v.id && !exclude.has('v:' + x.id) && items['v:' + x.id]?.reps)
  if (!same.length) return null
  const pick = same[Math.floor(Math.random() * Math.min(3, same.length))]
  const needS = ['context', 'fix', 'pick', 'build', 'dictate'].includes(it.task)
  const task: VerbTask = needS && !SENTENCES_BY_VERB[pick.id] ? 'forms' : it.task === 'si' ? 'forms' : it.task
  return verbItem(pick, task, items, settings)
}

/** Focus: tasks from the weakest categories (up to three), split according to the size of the mistake. */
export function buildFocus(items: Record<string, MemState>, settings: Settings, profile: Profile, n = 12): QItem[] {
  const w = weakest(profile, 3)
  if (!w.length) return []
  const total = w.reduce((a, x) => a + x.err, 0)
  const exclude = new Set<string>()
  const out: QItem[] = []
  for (const x of w) {
    const k = Math.max(2, Math.round((x.err / total) * n))
    for (const q of itemsForCat(x.c, items, settings, exclude, k)) { exclude.add(q.key); out.push(q) }
  }
  return shuffle(out).slice(0, n)
}

/** For training: how many focus tasks to add (more if the mistakes are big). */
export function focusFor(items: Record<string, MemState>, settings: Settings, profile: Profile, topics: TopicId[], taken: Set<string>): QItem[] {
  const f = buildFocus(items, settings, profile, 6).filter((q) => !taken.has(q.key))
  return f.filter((q) => {
    const c = catsOf(q)[0]
    const t = q.kind === 'verb' ? 'verbs' : q.deck.id
    return topics.includes(t as TopicId) || c.startsWith('vt:')
  }).slice(0, 4)
}

/** Live: the language model creates new tasks for the chosen type (always new) and returns them as tasks for the session. */
export async function liveItems(sec: string, n = 3): Promise<QItem[]> {
  const t = secTopic(sec)
  if (!t) return []
  const d = DECK_BY_ID[t]
  const qs = d.cards.filter((c) => c.sec === sec).map((c) => c.q)
  const r = await freshItems(sec, qs, true)
  const cards = (r?.items || []).map((g) => toCard(sec, g)).filter(Boolean) as Card[]
  if (!cards.length) return []
  addAiCards(cards.map((card) => ({ sec, card })))
  try {
    const stored = JSON.parse(localStorage.getItem(AI_KEY) || '[]')
    localStorage.setItem(AI_KEY, JSON.stringify([...stored, ...cards.map((card) => ({ sec, card }))].slice(-1500)))
  } catch { /* */ }
  return cards.slice(0, n).map((c) => ({ kind: 'card' as const, key: `c:${t}/${c.id}`, deck: d, card: c }))
}

/** Which task types should be generated live in this session: weak ones first, otherwise those already in the session. */
export function liveSecsFor(queue: QItem[], profile: Profile): string[] {
  const weakSecs = weakest(profile, 5, 2).map((w) => w.c).filter((c) => TEST_BANK[c])
  const inQueue = [...new Set(queue.flatMap((q) => (q.kind === 'card' && q.card.sec && TEST_BANK[q.card.sec] ? [q.card.sec] : [])))]
  const pool = [...new Set([...weakSecs, ...inQueue])].filter((s) => !NO_AI.has(s))
  if (!pool.length) return shuffle(['p_brackets', 'a_test', 'v_word', 'v_cross', 'p_dialog']).slice(0, 1)
  return pool.slice(0, 2)
}

// the hardest task types from the test: open answers (typing), dialogues, word formation, idioms
const HARD_SECS = ['p_dialog', 'p_brackets', 'v_word', 'v_form', 'v_idiom', 'v_cross', 'v_prep', 'a_test']
/** A challenge when you are doing great: a hard task from the test (typing rather than choice) that you have not seen yet or that is due. */
export function challengeItem(items: Record<string, MemState>, exclude: Set<string>): QItem | null {
  for (const sec of shuffle(HARD_SECS.filter((x) => TEST_BANK[x]))) {
    const got = cardsOfCat(sec, items, exclude, 10)
    // challenge: the hardest (as rated by Jev) among the candidates, typing rather than choice
    const hard = (q: QItem) => (q.kind === 'card' ? (cardB(q.card) ?? 0) + (q.card.kind === 'type' ? 0.4 : 0) : 0)
    const pick = got.sort((a, b) => hard(b) - hard(a))[0]
    if (pick) return pick
  }
  return null
}
