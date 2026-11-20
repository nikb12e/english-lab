// Weak point model. Every answer updates the mistake estimate for several “categories” at once:
//  the kind of test task (e.g. a_test, p_brackets), the verb task type (fix, context …), the verb pattern (AAA, ABB, ABC)
//  and the verb family (e.g. -ought, i-a-u). The estimate is a moving average (newer answers count more), so a
//  weak point you fix settles down by itself. From this the training builds a focus: more similar tasks where you make mistakes.
import type { QItem } from './content'
import { getState, updateProfile, type Profile } from './store'
import type { TopicId } from '../data/types'

export interface WeakStat { e: number; n: number; t: number }
const ALPHA = 0.3
const HALF_LIFE_DAYS = 10

export function catsOf(it: QItem): string[] {
  if (it.kind === 'verb') return ['vt:' + it.task, 'vp:' + it.verb.type, 'vf:' + it.verb.fam]
  return [it.card.sec || 'd:' + it.deck.id]
}

/** A mistake fades over time: after 10 days without practice it counts half as much. */
export function errNow(s: WeakStat | undefined, now = Date.now()) {
  if (!s) return 0
  const days = (now - s.t) / 86400000
  return s.e * Math.pow(0.5, days / HALF_LIFE_DAYS)
}

export function recordAnswer(it: QItem, ok: boolean) {
  const now = Date.now()
  updateProfile((p) => {
    const weak = { ...(p.weak || {}) }
    for (const c of catsOf(it)) {
      const s = weak[c] || { e: 0.25, n: 0, t: now }
      const prior = errNow(s, now)
      weak[c] = { e: prior + ALPHA * ((ok ? 0 : 1) - prior), n: s.n + 1, t: now }
    }
    return { ...p, weak }
  })
}

const LABEL: Record<string, string> = {
  'vt:forms': 'Verbs: three forms', 'vt:inf': 'Verbs from the infinitive', 'vt:reverse': 'Verbs backwards', 'vt:context': 'Verb in a sentence', 'vt:hunt': 'Spot the mistake',
  'vt:listen': 'Dictation', 'vt:si': '-s in -ing', 'vt:fix': 'Fix the mistake', 'vt:odd': 'Verb patterns', 'vt:pick': 'Choose the form',
  'vp:AAA': 'AAA verbs (cut, cut, cut)', 'vp:ABB': 'ABB verbs (buy, bought, bought)', 'vp:ABC': 'ABC verbs (sing, sang, sung)', 'vp:ABA': 'ABA verbs (run, ran, run)', 'vp:AAB': 'AAB verbs (beat, beat, beaten)',
}
export function catLabel(c: string, secName?: (s: string) => string | undefined) {
  if (LABEL[c]) return LABEL[c]
  if (c.startsWith('vf:')) return 'Family ' + c.slice(3)
  return secName?.(c) || c
}

/** The weakest categories: enough answers and a high share of mistakes. */
export function weakest(p: Profile = getState().profile, k = 3, minN = 3) {
  const now = Date.now()
  return Object.entries(p.weak || {})
    .filter(([, s]) => s.n >= minN)
    .map(([c, s]) => ({ c, err: errNow(s, now), n: s.n }))
    .filter((x) => x.err >= 0.3)
    .sort((a, b) => b.err - a.err)
    .slice(0, k)
}

/** Which topic a category belongs to (for choosing tasks). */
export const isVerbCat = (c: string) => c.startsWith('vt:') || c.startsWith('vp:') || c.startsWith('vf:')
export type { TopicId }
