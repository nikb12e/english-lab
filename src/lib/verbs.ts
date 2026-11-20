import { RAW_VERBS } from '../data/verbs'

export type Form = 'inf' | 'past' | 'pp'
export const FORMS: Form[] = ['inf', 'past', 'pp']
export const FORM_LABEL: Record<Form, string> = { inf: 'Infinitive', past: 'Past simple', pp: 'Past participle' }
export const FORM_SL: Record<Form, string> = { inf: 'infinitive', past: 'past simple', pp: 'past participle' }

export type VerbType = 'AAA' | 'AAB' | 'ABA' | 'ABB' | 'ABC'
export const TYPE_TXT: Record<VerbType, string> = {
  AAA: 'all three forms the same',
  AAB: 'infinitive = past',
  ABA: 'infinitive = participle',
  ABB: 'past = participle',
  ABC: 'all three different',
}

export interface Verb {
  id: string
  idx: number
  slo: string
  tier: number
  note: string
  shown: Record<Form, string[]>
  accept: Record<Form, Set<string>>
  type: VerbType
  fam: string
  end: string
  dup: boolean
  third: string
  ing: string
}

const split = (s?: string) => (s || '').split('/').map((x) => x.trim()).filter(Boolean)

// -s and -ing forms (the “Present” and “Gerund” columns on the sheet). Exceptions the rules do not cover:
const ING_OVERRIDE: Record<string, string> = {
  quit: 'quitting', bid: 'bidding', fit: 'fitting', wet: 'wetting', foresee: 'foreseeing', undo: 'undoing', forecast: 'forecasting', broadcast: 'broadcasting', saw: 'sawing', withstand: 'withstanding', undertake: 'undertaking',
  be: 'being', see: 'seeing', flee: 'fleeing', shoe: 'shoeing', lie: 'lying', die: 'dying',
  begin: 'beginning', forget: 'forgetting', forbid: 'forbidding', overcome: 'overcoming', upset: 'upsetting',
  withdraw: 'withdrawing', withhold: 'withholding', understand: 'understanding', repay: 'repaying', befall: 'befalling',
  beset: 'besetting', mow: 'mowing', sew: 'sewing', sow: 'sowing', show: 'showing', throw: 'throwing', blow: 'blowing',
  grow: 'growing', know: 'knowing', draw: 'drawing', crow: 'crowing', strew: 'strewing', hew: 'hewing',
}
const THIRD_OVERRIDE: Record<string, string> = { be: 'is', have: 'has', do: 'does', go: 'goes', fly: 'flies', undo: 'undoes' }
const vowel = (c: string) => 'aeiou'.includes(c)

function ingForm(v: string): string {
  if (ING_OVERRIDE[v]) return ING_OVERRIDE[v]
  if (v.endsWith('ie')) return v.slice(0, -2) + 'ying'
  if (v.endsWith('ee') || v.endsWith('oe') || v.endsWith('ye')) return v + 'ing'
  if (v.endsWith('e')) return v.slice(0, -1) + 'ing'
  const n = v.length
  // one syllable CVC (one vowel before the final consonant): double
  const vowelsCount = (v.match(/[aeiou]+/g) || []).length
  if (n >= 3 && vowelsCount === 1 && !vowel(v[n - 1]) && vowel(v[n - 2]) && !vowel(v[n - 3]) && !'wxy'.includes(v[n - 1])) {
    return v + v[n - 1] + 'ing'
  }
  // qu + vowel (quit) or spl + it
  return v + 'ing'
}
function thirdForm(v: string): string {
  if (THIRD_OVERRIDE[v]) return THIRD_OVERRIDE[v]
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + 'es'
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies'
  return v + 's'
}

function vtype(a: string, b: string, c: string): VerbType {
  if (a === b && b === c) return 'AAA'
  if (b === c) return 'ABB'
  if (a === c) return 'ABA'
  if (a === b) return 'AAB'
  return 'ABC'
}
function famKey(a: string, b: string, c: string) {
  let p = 0
  while (p < a.length && a[p] === b[p] && a[p] === c[p]) p++
  return a.slice(p) + '>' + b.slice(p) + '>' + c.slice(p)
}

export const VERBS: Verb[] = RAW_VERBS.map((r, i) => {
  const shown = { inf: [r[0]], past: split(r[1]), pp: split(r[2]) }
  const a = shown.inf[0], b = shown.past[0], c = shown.pp[0]
  return {
    id: r[0],
    idx: i,
    slo: r[3],
    tier: r[4],
    note: r[7] || '',
    shown,
    accept: {
      inf: new Set([r[0]]),
      past: new Set([...shown.past, ...split(r[5])]),
      pp: new Set([...shown.pp, ...split(r[6])]),
    },
    type: vtype(a, b, c),
    fam: famKey(a, b, c),
    end: b.slice(-4) + '|' + c.slice(-4),
    dup: false,
    third: thirdForm(r[0]),
    ing: ingForm(r[0]),
  }
})
const sloCount: Record<string, number> = {}
VERBS.forEach((v) => (sloCount[v.slo] = (sloCount[v.slo] || 0) + 1))
VERBS.forEach((v) => (v.dup = sloCount[v.slo] > 1))

export const VERB_BY_ID: Record<string, Verb> = Object.fromEntries(VERBS.map((v) => [v.id, v]))

export function family(v: Verb): Verb[] {
  if (v.type === 'AAA') return VERBS.filter((x) => x !== v && x.type === 'AAA').sort((a, b) => a.tier - b.tier).slice(0, 4)
  let sib = VERBS.filter((x) => x !== v && x.fam === v.fam)
  if (sib.length < 2) sib = sib.concat(VERBS.filter((x) => x !== v && !sib.includes(x) && x.end === v.end && x.type === v.type))
  return sib.sort((a, b) => a.tier - b.tier).slice(0, 4)
}
