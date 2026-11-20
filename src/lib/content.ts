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
// dodatni stavki, ki jih je jezikovni model ustvaril med uporabo
try { addSentences(JSON.parse(localStorage.getItem('el:aiS') || '[]')) } catch { /* */ }

const SEEN_KEY = 'el:sSeen'
let sentSeen: Record<string, number> = {}
try { sentSeen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { sentSeen = {} }

/** Izbere stavek, ki ga uporabnik najdlje ni videl; ko jih za glagol zmanjka, v ozadju naroči nove. */
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

// poved za posamezno nalogo v seji je izbrana enkrat, zato jo lahko glas pripravi že nalogo prej
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
    const { supabase } = await import('./supabase')
    const { data: ses } = await supabase.auth.getSession()
    if (!ses.session) return
    const exclude = (SENTENCES_BY_VERB[id] || []).filter((x) => x[1] === form).map((x) => x[2])
    const { data } = await supabase.functions.invoke('ai', { body: { action: 'gen', verb: { inf: id, form, slo: v.slo, answers: [...v.accept[form]] }, exclude } })
    const items: Sentence[] = (data?.items || []).map((x: { en: string; sl: string }) => [id, form, x.en, x.sl] as Sentence)
    if (!items.length) return
    addSentences(items)
    const stored: Sentence[] = JSON.parse(localStorage.getItem('el:aiS') || '[]')
    localStorage.setItem('el:aiS', JSON.stringify([...stored, ...items].slice(-800)))
  } catch { /* brez povezave: ostanejo obstoječi stavki */ }
}

export type QItem =
  | { kind: 'verb'; key: string; verb: Verb; task: VerbTask; placement?: boolean }
  | { kind: 'card'; key: string; deck: Deck; card: Card }

/** Samodejna težavnost (brez nastavitve): iz točnosti zadnjih 14 dni.
 *  Raziskave priklica priporočajo okoli 80 % uspeha; če gre bolje kot 88 %, novi glagoli pridejo z roba znanja. */
export function effDiff(p: Profile = getState().profile): Difficulty {
  let n = 0, c = 0
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    n += p.days[k]?.n || 0; c += p.days[k]?.c || 0
  }
  // samodejna raven: zelo zanesljiv učenec dobi najtežje naloge, zanesljiv težje, sicer normalne
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

/** Samodejni tip naloge za glagol glede na spomin. */
export function autoVerbItem(v: Verb, items: Record<string, MemState>, settings: Settings): QItem {
  const c = items['v:' + v.id]
  // samo za preizkuse na lokalnem strežniku: vsili tip naloge
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

/** Utrjen glagol: vsaj dvakrat zapored pravilno (ali pravilno že ob prvem srečanju). */
export const UTRJEN = 2
/** Začeti, a še neutrjeni glagoli (vsaj enkrat vprašani, niz pravilnih < 2). */
export const openVerbKeys = (items: Record<string, MemState>) =>
  VERBS.map((v) => 'v:' + v.id).filter((k) => items[k]?.reps && runOf(items[k]) < UTRJEN)
/** Velikost skupine novih glagolov. */
export const verbBatch = (s: Settings) => Math.max(1, Math.min(10, s.verbBatch || 5))
/** Novi glagoli pridejo samo, ko so vsi začeti glagoli utrjeni; takrat pride ena skupina. */
export const newVerbsLeft = (s: Settings, _p?: Profile, items?: Record<string, MemState>) =>
  items && openVerbKeys(items).length ? 0 : verbBatch(s)
export const newCardsLeft = (s: Settings, _p?: Profile) => s.newCards

export function unseenCards(items: Record<string, MemState>, topics: TopicId[]): QItem[] {
  const decks = GRAMMAR.filter((d) => topics.includes(d.id))
  // naključni vrstni red: tipi nalog se mešajo, zato vsaka seja izgleda drugače
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

/** Pametni trening: zapadle ponovitve (najbolj pozabljene najprej), novi glagoli na meji tvojega znanja, nove slovnične kartice. */
export function buildSmart(items: Record<string, MemState>, settings: Settings, profile: Profile, topics: TopicId[]): QItem[] {
  const dk = dueKeys(items, topics).slice(0, 70)
  // neutrjeni glagoli pridejo v vajo, tudi če po urniku še niso na vrsti: najprej jih utrdiš
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
  // fokus na šibke točke: nekaj nalog iz kategorij, kjer največ grešiš, razporejenih skozi trening
  const focus = focusFor(items, settings, profile, topics, new Set(base.map((q) => q.key)))
  return separateSameVerb(interleave(base, focus))
}

/** Ista beseda ne sme priti dvakrat zaporedoma. */
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

/** Vaja enega tipa naloge za glagole. */
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
  // šibki in pozabljajoči imajo prednost
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

/** Vse skupaj: mešanica vsega, kar je zapadlo, in malo novega iz vsake teme. */
export function buildEverything(items: Record<string, MemState>, settings: Settings, profile: Profile): QItem[] {
  return buildSmart(items, settings, profile, ['verbs', 'present', 'articles', 'nouns', 'vocab'])
}

// ───────── jezikovni model: sveže testne naloge ─────────
import { freshItems, type GenItem } from './ai'
import { TEST_BANK } from '../data/testBank'

const AI_KEY = 'el:aiC'
const hashStr = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }
const secTopic = (sec: string): TopicId | null => TEST_BANK[sec]?.topic || null
/** sklopi brez sprotnega generiranja (slike so ročno narisane) */
export const NO_AI = new Set(['v_pic'])
function toCard(sec: string, g: GenItem): Card | null {
  const id = `ai_${sec}_${hashStr(g.q)}`
  // diff: težavnost 1-5, ki jo ob nastanku naloge oceni Jev
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

/** Ko v kaki skupini zmanjka novih nalog, jezikovni model (GPT-6 Luna) ustvari nove, preverjene naloge. */
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

/** Preverjanje: naloge v vrstnem redu in obsegu Mock testa, z izbiro šibkih in še nevidenih nalog. */
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
  v_cross: ['Iz definicije', 'opis v eno besedo'], v_explain: ['Explain in English', 'oceni jezikovni model'], p_brackets: ['Present v oklepaju', 'simple ali continuous'],
  p_state: ['Stanje ali dejanje', 'think, have, see, weigh'], p_spell: ['-s in -ing pravopis', 'hopping, lying, panicking'], v_opp: ['Nasprotja', 'dishonest, impatient'],
  v_word: ['Ena beseda', 'pomen v oklepaju'], a_test: ['Členi s testa', 'the Thames, in prison'], v_form: ['Tvorjenje besed', 'ENJOY v enjoyable'],
  v_conf: ['Zamenljive besede', 'trip, journey, travel'], v_prep: ['Predlogi', 'on foot, off the beaten track'], v_phr: ['Frazni glagoli', 'set off, hold up'],
  v_idiom: ['Idiomi', 'cold feet, see eye to eye'], v_clothes: ['Oblačila', 'zadrga, karirast, semiš'], v_appear: ['Videz in osebnost', 'stubble, fussy'],
  v_holiday: ['Počitnice', 'half board, stopover'],
  p_dialog: ['Present v dialogu', 'kot telefonski pogovor na listu'], v_odd: ['Ne spada zraven', 'calm, rough, open … sea'],
  v_noun: ['Ugani samostalnik', 'sandy, secluded … beach'], v_reply: ['Pravi odgovor', 'odgovori na izjave o potovanju'],
  v_announce: ['Obvestila na poti', 'gate, platform, luggage'], v_explain_idiom: ['Pomen idiomov', 'dressed to kill, cold feet'],
  v_write: ['Pisanje', 'opis osebe, počitnice; oceni učitelj AI'],
  v_pic: ['Poimenuj sliko', '82 ilustracij z učnih listov'],
}
/** Vaja ene vrste testnih nalog: najprej šibke in še nevidene. */
export function buildSecDrill(sec: string, items: Record<string, MemState>, n = 12): QItem[] {
  const t: TopicId = sec === 'v_explain' || sec === 'v_write' ? 'vocab' : TEST_BANK[sec].topic
  const d = DECK_BY_ID[t]
  const now = Date.now()
  return d.cards.filter((c) => c.sec === sec).map((c) => {
    const st = items[`c:${t}/${c.id}`]
    return { c, w: !st?.reps ? 1 + Math.random() : (1 - retrievability(st, now)) + (st.lapses || 0) * 0.4 + Math.random() * 0.4 }
  }).sort((a, b) => b.w - a.w).slice(0, n).map(({ c }) => ({ kind: 'card' as const, key: `c:${t}/${c.id}`, deck: d, card: c }))
}

// ───────── ciljano: podobne naloge in fokus na šibke točke ─────────
import { weakest, isVerbCat, catsOf } from './weak'
import { family } from './verbs'

const cardKey = (t: TopicId, id: string) => `c:${t}/${id}`
function topicOfSec(sec: string): TopicId | null {
  if (sec === 'v_explain' || sec === 'v_write') return 'vocab'
  if (sec.startsWith('d:')) return sec.slice(2) as TopicId
  return TEST_BANK[sec]?.topic || null
}
// težavnost kartice (Jev): delež nalog v banki, ki so lažje od te, preslikan na lestvico sposobnosti θ
const DIFF_SORTED = Object.values(BANK_DIFF).sort((a, b) => a - b)
export function cardB(c: Card): number | null {
  const raw = BANK_DIFF[c.id] ?? (typeof (c as { diff?: number }).diff === 'number' ? ((c as { diff?: number }).diff! - 1) * 0.75 : null)
  if (raw == null) return null
  let lo = 0, hi = DIFF_SORTED.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (DIFF_SORTED[m] < raw) lo = m + 1; else hi = m }
  return -1.3 + 2.6 * (lo / Math.max(1, DIFF_SORTED.length))
}
// ciljna verjetnost uspeha za nove kartice glede na tok seje: ko ne gre, lažje; ko gre odlično, težje
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
      // nove: najbližje ciljni verjetnosti uspeha (težavnost oceni Jev); znane: tiste, ki jih najbolj pozabljaš ali si jih zgrešil
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

/** Po napaki: podobna naloga iste vrste (druga kartica iste skupine ali glagol iste družine z isto nalogo). */
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

/** Fokus: naloge iz najšibkejših kategorij (do treh), razdeljene glede na velikost napake. */
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

/** Za trening: koliko fokusnih nalog dodati (več, če so napake velike). */
export function focusFor(items: Record<string, MemState>, settings: Settings, profile: Profile, topics: TopicId[], taken: Set<string>): QItem[] {
  const f = buildFocus(items, settings, profile, 6).filter((q) => !taken.has(q.key))
  return f.filter((q) => {
    const c = catsOf(q)[0]
    const t = q.kind === 'verb' ? 'verbs' : q.deck.id
    return topics.includes(t as TopicId) || c.startsWith('vt:')
  }).slice(0, 4)
}

/** Sproti: GPT-6 Luna ustvari nove naloge za izbrano vrsto (vedno nove, ne iz predpomnilnika) in jih vrne kot naloge za sejo. */
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

/** Katere vrste nalog naj se v tej seji ustvarijo sproti: najprej šibke, sicer tiste, ki so že v seji. */
export function liveSecsFor(queue: QItem[], profile: Profile): string[] {
  const weakSecs = weakest(profile, 5, 2).map((w) => w.c).filter((c) => TEST_BANK[c])
  const inQueue = [...new Set(queue.flatMap((q) => (q.kind === 'card' && q.card.sec && TEST_BANK[q.card.sec] ? [q.card.sec] : [])))]
  const pool = [...new Set([...weakSecs, ...inQueue])].filter((s) => !NO_AI.has(s))
  if (!pool.length) return shuffle(['p_brackets', 'a_test', 'v_word', 'v_cross', 'p_dialog']).slice(0, 1)
  return pool.slice(0, 2)
}

// najtežje vrste s testa: odprti odgovori (vpis), dialogi, besedotvorje, idiomi
const HARD_SECS = ['p_dialog', 'p_brackets', 'v_word', 'v_form', 'v_idiom', 'v_cross', 'v_prep', 'a_test']
/** Izziv, ko ti gre odlično: težka naloga s testa (raje vpis kot izbira), ki je še nisi videl ali je zapadla. */
export function challengeItem(items: Record<string, MemState>, exclude: Set<string>): QItem | null {
  for (const sec of shuffle(HARD_SECS.filter((x) => TEST_BANK[x]))) {
    const got = cardsOfCat(sec, items, exclude, 10)
    // izziv: najtežja (po oceni Jev) med kandidati, raje vpis kot izbira
    const hard = (q: QItem) => (q.kind === 'card' ? (cardB(q.card) ?? 0) + (q.card.kind === 'type' ? 0.4 : 0) : 0)
    const pick = got.sort((a, b) => hard(b) - hard(a))[0]
    if (pick) return pick
  }
  return null
}
