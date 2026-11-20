// Animated explanations: shown when accuracy on a task type in the session drops below 60 %, and at the milestones of 25, 50, 75 and 100 % of verbs known.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, ArrowRight } from 'lucide-react'
import { VERBS, type Verb, type VerbType } from '../lib/verbs'
import { maturity } from '../lib/fsrs'
import { getState } from '../lib/store'

export type RuleId = 'pattern' | 'pastpp' | 'present' | 'state' | 'spell' | 'articles' | 'wordform' | 'opposites' | 'recap' | 'milestone'

/** Which explanation belongs to which task type. */
export function ruleFor(cat: string): RuleId {
  if (cat === 'v:forms' || cat === 'v:inf' || cat === 'v:reverse' || cat === 'v:hunt' || cat === 'v:odd' || cat === 'v:listen') return 'pattern'
  if (cat.startsWith('v:')) return 'pastpp'
  if (cat === 'p_state') return 'state'
  if (cat === 'p_spell') return 'spell'
  if (cat === 'present' || cat === 'p_brackets') return 'present'
  if (cat === 'articles' || cat === 'a_test') return 'articles'
  if (cat === 'v_form') return 'wordform'
  if (cat === 'v_opp') return 'opposites'
  return 'recap'
}

const ease = [0.16, 1, 0.3, 1] as const
const pop = (d: number) => ({ initial: { opacity: 0, y: 14, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: 'spring' as const, stiffness: 380, damping: 26, delay: d } })

function Slots({ v, d, hl }: { v: [string, string, string]; d: number; hl?: [number, number, number] }) {
  const cols = ['var(--violet)', 'var(--mint)', 'var(--amber)']
  return (
    <div className="xs-row">
      {v.map((w, i) => (
        <motion.span key={i} className="xs-slot" {...pop(d + i * 0.18)} style={{ background: hl ? cols[hl[i]] : 'var(--field)', color: hl ? '#fff' : 'var(--ink)' }}>{w}</motion.span>
      ))}
    </div>
  )
}

function Pattern() {
  const rows: { t: VerbType; ex: [string, string, string]; hl: [number, number, number]; txt: string }[] = [
    { t: 'AAA', ex: ['cut', 'cut', 'cut'], hl: [0, 0, 0], txt: 'all three the same: cut, put, let, set, shut, hit, cost, quit, upset' },
    { t: 'ABB', ex: ['buy', 'bought', 'bought'], hl: [0, 1, 1], txt: 'past = participle: bring, think, teach, catch, seek → -ought/-aught' },
    { t: 'ABC', ex: ['sing', 'sang', 'sung'], hl: [0, 1, 2], txt: 'all different: i → a → u (drink, ring, sink, swim, begin, shrink)' },
    { t: 'ABA', ex: ['run', 'ran', 'run'], hl: [0, 1, 0], txt: 'participle = infinitive: run, come, become, overcome' },
  ]
  return (
    <div className="xs">
      {rows.map((r, i) => (
        <div key={r.t} className="xs-block">
          <motion.b className="xs-tag" {...pop(0.1 + i * 0.7)}>{r.t}</motion.b>
          <Slots v={r.ex} d={0.2 + i * 0.7} hl={r.hl} />
          <motion.p {...pop(0.6 + i * 0.7)}>{r.txt}</motion.p>
        </div>
      ))}
      <motion.p className="xs-tip" {...pop(3.2)}>Tip: learn in families. If you know <b>sing, sang, sung</b>, you also know <b>ring, rang, rung</b>.</motion.p>
    </div>
  )
}

function PastPP() {
  return (
    <div className="xs">
      <div className="xs-time">
        <motion.div className="xs-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease }} />
        <motion.span className="xs-dot past" {...pop(0.6)}>yesterday</motion.span>
        <motion.span className="xs-dot now" {...pop(0.9)}>now</motion.span>
      </div>
      <motion.div className="xs-card" {...pop(1.1)}><b>Past simple</b> = finished in the past, with a time: <i lang="en">Yesterday I <u>went</u> home.</i></motion.div>
      <motion.div className="xs-card" {...pop(1.6)}><b>Past participle</b> comes after <b>have / has / had</b>: <i lang="en">I have <u>gone</u>.</i></motion.div>
      <motion.div className="xs-card" {...pop(2.1)}>… and in the passive after <b>be</b>: <i lang="en">The car was <u>stolen</u>.</i></motion.div>
      <motion.p className="xs-tip" {...pop(2.7)}>First look for have/has/had or was/were/been. If they are not there and the time is in the past, it is past simple.</motion.p>
    </div>
  )
}

function Present() {
  return (
    <div className="xs">
      <div className="xs-two">
        <motion.div className="xs-card" {...pop(0.1)}>
          <b>Present simple</b>
          <div className="xs-dots">{[0, 1, 2, 3, 4].map((i) => <motion.i key={i} {...pop(0.3 + i * 0.12)} />)}</div>
          habit, fact, timetable<br /><small lang="en">usually, every day, always, never</small>
        </motion.div>
        <motion.div className="xs-card" {...pop(0.5)}>
          <b>Present continuous</b>
          <div className="xs-pulse"><motion.i animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} /></div>
          now, temporary, arranged<br /><small lang="en">now, at the moment, this week, Look!</small>
        </motion.div>
      </div>
      <motion.div className="xs-card" {...pop(1.2)}><b>Test traps:</b> <i lang="en">always + -ing</i> = annoying habit (<i lang="en">He is always asking me!</i>); timetable = simple (<i lang="en">The train leaves at 5.</i>); arrangement = continuous (<i lang="en">We're having a party tonight.</i>).</motion.div>
      <motion.p className="xs-tip" {...pop(1.8)}>Questions and negatives: do/does + infinitive, am/is/are + -ing. <i lang="en">(he, be) → Why is he being so childish?</i></motion.p>
    </div>
  )
}

function State() {
  const pairs: [string, string, string][] = [
    ['think', 'I think it\\\'s great. (opinion)', 'I\\\'m thinking about it. (considering)'],
    ['have', 'I have a car. (own)', 'We\\\'re having dinner. (eating)'],
    ['see', 'I see what you mean. (understand)', 'I\\\'m seeing the doctor at 4. (appointment)'],
    ['look', 'You look tired. (appear)', 'He is looking at photos. (watching)'],
    ['weigh', 'It weighs 70 kg. (has a weight of)', 'She is weighing herself. (measuring)'],
    ['taste', 'The soup tastes great. (has a flavour)', 'He is tasting the soup. (trying)'],
  ]
  return (
    <div className="xs">
      <motion.p {...pop(0)}>A state verb describes an opinion, a feeling, possession or the senses, so it is not used in the -ing form. The same verb can also be an action:</motion.p>
      {pairs.map(([v, s, d], i) => (
        <motion.div key={v} className="xs-pair" {...pop(0.3 + i * 0.35)}>
          <b lang="en">{v}</b><span className="st" lang="en">{s}</span><span className="dy" lang="en">{d}</span>
        </motion.div>
      ))}
    </div>
  )
}

function Spell() {
  const rows: [string, string, string][] = [['watch', '+es', 'watches'], ['study', 'y → ies', 'studies'], ['play', '+s', 'plays'], ['make', 'drop e', 'making'], ['hop', 'double', 'hopping'], ['lie', 'ie → y', 'lying'], ['panic', '+k', 'panicking'], ['travel', 'BrE: ll', 'travelling']]
  return (
    <div className="xs">
      {rows.map(([a, r, b], i) => (
        <motion.div key={a} className="xs-pair" {...pop(0.1 + i * 0.22)}><b lang="en">{a}</b><span className="st">{r}</span><span className="dy" lang="en">{b}</span></motion.div>
      ))}
      <motion.p className="xs-tip" {...pop(2)}>We only double when the last syllable is stressed and ends in consonant, vowel, consonant: <i lang="en">begin → beginning</i>, but <i lang="en">visit → visiting</i>.</motion.p>
    </div>
  )
}

function Articles() {
  const rows: [string, string][] = [
    ['the', 'rivers, seas, oceans, deserts, mountain ranges: the Thames, the Mediterranean, the Sahara, the Rocky Mountains'],
    ['–', 'lakes, single mountains, most countries: Lake Geneva, Mount Everest, France'],
    ['the', 'plural countries or names with “republic, kingdom, states”: the United States, the UK, the Netherlands'],
    ['–', 'institutions used for their purpose: in prison, at school, in hospital; the building as a place: to the prison'],
    ['the', 'the + adjective for a group: the poor, the rich, the elderly'],
    ['–', 'abstract nouns and sports in general: crime, unemployment, athletics'],
    ['a/an', 'by sound: an hour, an honest man, a university, a European'],
  ]
  return (
    <div className="xs">
      {rows.map(([a, t], i) => (
        <motion.div key={i} className="xs-art" {...pop(0.1 + i * 0.3)}><b className={a === '–' ? 'z' : a === 'the' ? 't' : 'a'}>{a}</b><span>{t}</span></motion.div>
      ))}
    </div>
  )
}

function WordForm() {
  const rows: [string, string, string][] = [['enjoy', '+able', 'enjoyable'], ['peace', '+ful', 'peaceful'], ['spice', 'e → y', 'spicy'], ['mountain', '+ous', 'mountainous'], ['tradition', '+al', 'traditional'], ['impress', '+ive', 'impressive'], ['luxury', 'y → ious', 'luxurious'], ['end', '+less', 'endless'], ['comfort', 'un + able', 'uncomfortable']]
  return (
    <div className="xs">
      {rows.map(([a, r, b], i) => (
        <motion.div key={a} className="xs-pair" {...pop(0.1 + i * 0.2)}><b lang="en">{a}</b><span className="st">{r}</span><span className="dy" lang="en">{b}</span></motion.div>
      ))}
      <motion.p className="xs-tip" {...pop(2)}>First read which part of speech is missing (an adjective comes before a noun), then check the meaning: does the sentence need a negative (un-, -less)?</motion.p>
    </div>
  )
}

function Opposites() {
  const rows: [string, string[]][] = [['un-', ['helpful', 'reliable', 'tidy', 'cheerful']], ['in-', ['considerate', 'secure', 'tolerant']], ['im-', ['patient', 'polite', 'mature']], ['ir-', ['responsible', 'rational']], ['dis-', ['honest', 'obedient', 'loyal']]]
  return (
    <div className="xs">
      {rows.map(([p, ws], i) => (
        <motion.div key={p} className="xs-art" {...pop(0.1 + i * 0.35)}><b className="t">{p}</b><span lang="en">{ws.join(', ')}</span></motion.div>
      ))}
      <motion.p className="xs-tip" {...pop(2)}>im- before p and m, ir- before r, il- before l (illegal). Some have a different word: <i lang="en">tight → loose, generous → mean</i>.</motion.p>
    </div>
  )
}

function Recap({ notes }: { notes: string[] }) {
  return (
    <div className="xs">
      <motion.p {...pop(0)}>These gave you trouble in this session. Read them once more:</motion.p>
      {notes.slice(-4).map((n, i) => <motion.div key={i} className="xs-card" {...pop(0.3 + i * 0.3)}>{n}</motion.div>)}
    </div>
  )
}

function Milestone({ pct }: { pct: number }) {
  const items = getState().items
  const by: Record<string, { n: number; k: number }> = {}
  for (const v of VERBS as Verb[]) {
    const b = (by[v.type] ||= { n: 0, k: 0 })
    b.n++
    if (maturity(items['v:' + v.id]) === 'mature') b.k++
  }
  return (
    <div className="xs">
      <motion.div className="xs-big" {...pop(0)}>{pct} %</motion.div>
      <motion.p {...pop(0.3)}>verbs you already know. This is how your knowledge looks by pattern:</motion.p>
      {Object.entries(by).map(([t, b], i) => (
        <motion.div key={t} className="xs-bar" {...pop(0.5 + i * 0.2)}>
          <b>{t}</b>
          <div><motion.i initial={{ width: 0 }} animate={{ width: `${(b.k / b.n) * 100}%` }} transition={{ duration: 0.9, ease, delay: 0.7 + i * 0.2 }} /></div>
          <span>{b.k}/{b.n}</span>
        </motion.div>
      ))}
      <motion.p className="xs-tip" {...pop(1.8)}>You know least where the bar is shortest. The algorithm will give you more practice there.</motion.p>
    </div>
  )
}

const TITLE: Record<RuleId, string> = {
  pattern: 'Irregular verb patterns', pastpp: 'Past simple or past participle?', present: 'Present simple or continuous?', state: 'State and action verbs',
  spell: 'Spelling: -s and -ing', articles: 'Articles with names and institutions', wordform: 'Word formation', opposites: 'Opposites with prefixes', recap: 'Quick review', milestone: 'Milestone',
}

export function RuleExplain({ rule, pct = 0, notes = [], onDone }: { rule: RuleId; pct?: number; notes?: string[]; onDone: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 1200); return () => clearTimeout(t) }, [])
  return (
    <AnimatePresence>
      <motion.div className="xs-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => ready && onDone()} />
      <motion.div className="xs-sheet" role="dialog" aria-modal="true" aria-label={TITLE[rule]}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
        <div className="xs-head"><span className="xs-ico"><Lightbulb /></span><div><small>{rule === 'milestone' ? 'Well done' : 'Animated explanation'}</small><h3>{TITLE[rule]}</h3></div></div>
        {rule === 'pattern' ? <Pattern /> : rule === 'pastpp' ? <PastPP /> : rule === 'present' ? <Present /> : rule === 'state' ? <State /> : rule === 'spell' ? <Spell />
          : rule === 'articles' ? <Articles /> : rule === 'wordform' ? <WordForm /> : rule === 'opposites' ? <Opposites /> : rule === 'milestone' ? <Milestone pct={pct} /> : <Recap notes={notes} />}
        <button className="btn hero w" style={{ marginTop: 16 }} onClick={onDone}>Got it, continue<ArrowRight /></button>
      </motion.div>
    </AnimatePresence>
  )
}
