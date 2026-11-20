// Model šibkih točk. Vsak odgovor posodobi oceno napak za več »kategorij« hkrati:
//  vrsta testne naloge (npr. a_test, p_brackets), tip naloge pri glagolih (fix, context …), vzorec glagola (AAA, ABB, ABC)
//  in družino glagola (npr. -ought, i-a-u). Ocena je drseče povprečje (novejši odgovori štejejo več), tako da se
//  šibka točka, ki jo popraviš, sama umiri. Iz tega trening sestavi fokus: več podobnih nalog tam, kjer grešiš.
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

/** Napaka se s časom pozablja: po 10 dneh brez vaje šteje pol manj. */
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
  'vt:forms': 'Glagoli: tri oblike', 'vt:inf': 'Glagoli iz infinitiva', 'vt:reverse': 'Glagoli nazaj', 'vt:context': 'Glagol v stavku', 'vt:hunt': 'Lov na napako',
  'vt:listen': 'Narek', 'vt:si': '-s in -ing', 'vt:fix': 'Popravi napako', 'vt:odd': 'Vzorci glagolov', 'vt:pick': 'Izberi obliko',
  'vp:AAA': 'Glagoli AAA (cut, cut, cut)', 'vp:ABB': 'Glagoli ABB (buy, bought, bought)', 'vp:ABC': 'Glagoli ABC (sing, sang, sung)', 'vp:ABA': 'Glagoli ABA (run, ran, run)', 'vp:AAB': 'Glagoli AAB (beat, beat, beaten)',
}
export function catLabel(c: string, secName?: (s: string) => string | undefined) {
  if (LABEL[c]) return LABEL[c]
  if (c.startsWith('vf:')) return 'Družina ' + c.slice(3)
  return secName?.(c) || c
}

/** Najšibkejše kategorije: dovolj odgovorov in visok delež napak. */
export function weakest(p: Profile = getState().profile, k = 3, minN = 3) {
  const now = Date.now()
  return Object.entries(p.weak || {})
    .filter(([, s]) => s.n >= minN)
    .map(([c, s]) => ({ c, err: errNow(s, now), n: s.n }))
    .filter((x) => x.err >= 0.3)
    .sort((a, b) => b.err - a.err)
    .slice(0, k)
}

/** Kateri temi kategorija pripada (za izbiro nalog). */
export const isVerbCat = (c: string) => c.startsWith('vt:') || c.startsWith('vp:') || c.startsWith('vf:')
export type { TopicId }
