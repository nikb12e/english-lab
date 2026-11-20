import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Type, Languages, Zap, Target, Search, Shuffle, Check, Undo2, TextCursorInput, Crosshair, Headphones, Gauge, Sparkles, ClipboardCheck, ArrowRight, Eraser, ListChecks, Shapes, Blocks, Link2, AudioLines, Swords, BookOpen, WholeWord, Component, ArrowLeftRight, Blend, Hash, Shirt, Smile, TreePalm, Megaphone, MessagesSquare, Quote, Drama, Split, Signpost, Brackets, MessageCircle, Layers, SpellCheck, CaseSensitive, Feather, PenLine, ChevronRight, Grid3x3, Image as ImageIcon } from 'lucide-react'
import { useStore, setSettings, updateProfile, getState } from '../lib/store'
import { VERBS, VERB_BY_ID } from '../lib/verbs'
import { maturity, retrievability, weakness, isWeak, fmtDue } from '../lib/fsrs'
import { buildFocus, buildSmart, buildPlacement, openVerbKeys, buildMockTest, topUpTests, MOCK_PLAN, SEC_NAME, buildSecDrill, buildVerbDrill, dueKeys, newCardsLeft, newVerbsLeft, unseenCards, verbItem, shuffle, today, dayOffset, GRAMMAR, type QItem } from '../lib/content'
import { levelOf, rating, PRIOR, pSuccess, type VerbTask } from '../lib/adaptive'
import { TOPICS, type TopicId } from '../data/types'
import { weakest, catLabel } from '../lib/weak'
import { VerbRow, spring } from '../components/ui'
import { Grid178 } from '../components/Grid178'
import { norm } from '../lib/check'
import { canSpeak } from '../lib/speech'
import { PicImg } from '../components/Pics'

export interface Nav {
  start: (items: QItem[], title: string, grow?: boolean) => void
  sprint: () => void
  cross: () => void
  arena: () => void
  openVerb: (id: string) => void
  toast: (m: string) => void
}

const enter = (d = 0) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring' as const, stiffness: 420, damping: 32, delay: d * 0.6 } })



/* ───────────────────────── DANES ───────────────────────── */
export function Today({ nav }: { nav: Nav }) {
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const [now] = useState(() => Date.now())
  const topics = settings.topics.length ? settings.topics : (['verbs'] as TopicId[])
  const due = useMemo(() => dueKeys(items, topics, now), [items, topics, now])
  const nv = topics.includes('verbs') ? Math.min(newVerbsLeft(settings, profile, items), VERBS.filter((v) => !items['v:' + v.id]?.reps).length) : 0
  const openN = topics.includes('verbs') ? openVerbKeys(items).length : 0
  const nc = Math.min(newCardsLeft(settings, profile), unseenCards(items, topics.filter((t) => t !== 'verbs')).length)
  const mature = VERBS.filter((v) => maturity(items['v:' + v.id]) === 'mature').length
  const learning = VERBS.filter((v) => items['v:' + v.id]?.reps).length
  const streak = profile.lastDay === today() || profile.lastDay === dayOffset(-1) ? profile.streak : 0
  const weak = VERBS.filter((v) => isWeak(items['v:' + v.id]))
  const known = profile.placed || profile.total >= 10
  const weakCats = useMemo(() => weakest(profile, 3), [profile])
  const queue = useMemo(() => (profile.placed ? buildSmart(items, settings, profile, topics) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.placed, settings, topics.join()])
  const preview = queue.filter((q): q is Extract<QItem, { kind: 'verb' }> => q.kind === 'verb').slice(0, 3)
  const untouched = VERBS.length - learning

  const pctKnown = Math.round((mature / VERBS.length) * 100)
  return (
    <div>
      <motion.h1 className="display" {...enter(0)}>Nepravilni glagoli</motion.h1>
      <motion.p className="lead" {...enter(0.04)}>Gozdni sklad in list za test, {VERBS.length} glagolov</motion.p>

      <motion.section className="card hero-card" {...enter(0.08)}>
        <div className="hero-top">
          <div>
            <div className="hero-num num">{mature}<span>/{VERBS.length}</span></div>
            <div className="hero-cap">glagolov znaš</div>
          </div>
          <div className="ring" style={{ ['--p' as string]: pctKnown }} aria-label={`${pctKnown} odstotkov`}><b className="num">{pctKnown}%</b></div>
        </div>
        <Grid178 items={items} onSelect={nav.openVerb} />
        <div className="legend">
          <span><i className="lg mature" />Znam <b className="num">{mature}</b></span>
          <span><i className="lg young" />Skoraj <b className="num">{VERBS.filter((v) => maturity(items['v:' + v.id]) === 'young').length}</b></span>
          <span><i className="lg learn" />Učim se <b className="num">{VERBS.filter((v) => maturity(items['v:' + v.id]) === 'learn').length}</b></span>
          <span><i className="lg new" />Novi <b className="num">{untouched}</b></span>
        </div>
      </motion.section>

      {!profile.placed ? (
        <motion.section className="card" {...enter(0.14)}>
          <div className="card-head"><span className="h3">Najprej uvrstitev</span><span className="muted small">14 glagolov</span></div>
          <p className="cta-note">Od lahkih do najtežjih. Kar znaš že zdaj, se takoj označi kot znano in ga ne ponavljaš.</p>
          <button className="btn hero w" onClick={() => nav.start(buildPlacement(profile, items, settings), 'Uvrstitev')}>Začni uvrstitev</button>
          <button className="btn ghost w sm" onClick={() => updateProfile((p) => ({ ...p, placed: true }))}>Preskoči</button>
        </motion.section>
      ) : (
        <motion.section className="card" {...enter(0.14)}>
          <div className="card-head"><span className="h3">Danes</span><span className="muted small">{openN ? `${openN} za utrditev, ` : ''}{due.length} ponovitev, {nv + nc} novih</span></div>
          {preview.length > 0 && (
            <div className="vtable">
              {preview.map((q) => (
                <div className="vtr" key={q.key}>
                  <span className="inf">{q.verb.id}<small>{q.verb.slo}</small></span>
                  <span className="blank" /><span className="blank" />
                </div>
              ))}
            </div>
          )}
          <button className="btn hero w" onClick={() => {
            if (queue.length) nav.start(queue, 'Trening', true)
            else nav.start(buildVerbDrill('forms', items, settings, profile), 'Dodatni trening')
          }}>
            <Play />{queue.length ? <>Začni <small>{queue.length} nalog</small></> : <>Dodatni trening</>}
          </button>
          <p className="tiny muted" style={{ margin: '10px 2px 0' }}>Ko glagol znaš v prvo, se takoj doda naslednji nov.</p>
        </motion.section>
      )}

      <motion.button className="mock-card" {...enter(0.17)} onClick={async () => {
        nav.toast('Pripravljam preverjanje …')
        await Promise.race([topUpTests(items, 4, MOCK_PLAN.map(([s]) => s).filter((s) => s !== 'verbs' && s !== 'v_explain')), new Promise((r) => setTimeout(r, 6000))])
        nav.start(buildMockTest(getState().items, settings), 'Preverjanje')
      }}>
        <span className="mock-ico"><ClipboardCheck /></span>
        <span className="mock-txt"><b>Preverjanje kot na testu</b><span>{MOCK_PLAN.reduce((a, [, n]) => a + n, 0)} nalog v zaporedju Mock testa, na koncu ocena</span></span>
        <ArrowRight />
      </motion.button>

      <motion.button className="arena-card" {...enter(0.18)} onClick={() => nav.arena()}>
        <span className="arena-ico"><Swords /></span>
        <span className="mock-txt"><b>Arena v živo</b><span>Tekmuj z ostalimi v realnem času, 8 hitrih vprašanj</span></span>
        <span className="live-dot" aria-hidden="true" />
      </motion.button>

      {weakCats.length > 0 && (
        <motion.section className="card weakcard" {...enter(0.19)}>
          <div className="card-head"><span className="h3">Tvoje šibke točke</span><span className="small muted">po zadnjih napakah</span></div>
          {weakCats.map((w) => (
            <div key={w.c} className="wk-row">
              <span>{catLabel(w.c, (c) => SEC_NAME[c]?.[0])}</span>
              <div className="wk-meter"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.round(w.err * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' as const }} /></div>
              <b className="num">{Math.round(w.err * 100)} %</b>
            </div>
          ))}
          <button className="btn primary w" style={{ marginTop: 12 }} onClick={() => nav.start(buildFocus(items, settings, profile, 14), 'Šibke točke', false)}><Target />Vadi šibke točke</button>
        </motion.section>
      )}

      <div className="section-title"><span className="h2">Hitre vaje</span></div>
      <motion.div className="duo quad" {...enter(0.2)}>
        <button className="tile t-amber" onClick={nav.sprint}><Zap /><b>Hitri krog</b><span>60 sekund{profile.sprintBest ? `, rekord ${profile.sprintBest}` : ''}</span></button>
        <button className="tile t-violet" onClick={nav.cross}><Grid3x3 /><b>Križanka</b><span>slike in namigi z listov</span></button>
        <button className="tile t-mint" onClick={() => nav.start(buildSecDrill('v_pic', items, 12), 'Poimenuj sliko')}><ImageIcon /><b>Poimenuj sliko</b><span>oblačila, videz, potovanja</span></button>
        <button className="tile t-coral" disabled={!weak.length} onClick={() => {
          const ids = weak.sort((a, b) => weakness(items['v:' + b.id]) - weakness(items['v:' + a.id])).slice(0, 15)
          nav.start(shuffle(ids.map((v) => verbItem(v, 'forms', items, settings))), 'Šibki glagoli')
        }}><Target /><b>Šibki glagoli</b><span>{weak.length ? `${weak.length} glagolov` : 'še ni napak'}</span></button>
      </motion.div>

      <motion.section className="card rows" {...enter(0.26)}>
        <div className="r"><span>Raven</span><b>{known ? levelOf(profile.theta) : 'še neznana'}</b></div>
        <div className="r"><span>Rating</span><b className="num">{known ? rating(profile.theta) : '–'}</b></div>
        <div className="r"><span>Zaporedni dnevi</span><b className="num">{streak}</b></div>
      </motion.section>
    </div>
  )
}

/* ───────────────────────── VAJE ───────────────────────── */
const TASKS: { id: VerbTask | 'sprint'; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'forms', name: 'Tri oblike', desc: 'slovensko v vse tri', icon: <Type /> },
  { id: 'inf', name: 'Iz infinitiva', desc: 'preteklik in deležnik', icon: <Languages /> },
  { id: 'reverse', name: 'Nazaj', desc: 'iz deležnika v ostali', icon: <Undo2 /> },
  { id: 'context', name: 'V stavku', desc: 'prava oblika v pravem času', icon: <TextCursorInput /> },
  { id: 'hunt', name: 'Lov na napako', desc: 'tri pasti, ena resnica', icon: <Crosshair /> },
  { id: 'listen', name: 'Narek', desc: 'slišiš obliko, napišeš vse', icon: <Headphones /> },
  { id: 'si', name: '-s in -ing', desc: 'goes, going, lying', icon: <Shuffle /> },
  { id: 'fix', name: 'Popravi napako', desc: 'kot na testu: najdi napačno obliko', icon: <Eraser /> },
  { id: 'pick', name: 'Izberi obliko', desc: 'prava oblika v stavku', icon: <ListChecks /> },
  { id: 'odd', name: 'Kateri ne spada', desc: 'vzorci AAA, ABB, ABC', icon: <Shapes /> },
  { id: 'build', name: 'Sestavi poved', desc: 'ploščice v pravem vrstnem redu', icon: <Blocks /> },
  { id: 'match', name: 'Poveži pare', desc: 'infinitiv z obliko, hitro', icon: <Link2 /> },
  { id: 'dictate', name: 'Narek povedi', desc: 'poslušaj in zapiši, kar manjka', icon: <AudioLines /> },
  { id: 'sprint', name: 'Hitri krog', desc: '60 sekund na tvoji ravni', icon: <Zap /> },
]

/** Sklopi s testa v skupinah, vsak s svojo ikono. */
const SEC_GROUPS: { title: string; tone: string; secs: [string, React.ReactNode][] }[] = [
  { title: 'Besedišče', tone: 'violet', secs: [['v_cross', <BookOpen />], ['v_word', <WholeWord />], ['v_form', <Component />], ['v_conf', <ArrowLeftRight />], ['v_opp', <Blend />], ['v_noun', <Hash />], ['v_odd', <Shapes />]] },
  { title: 'Teme z listov', tone: 'mint', secs: [['v_clothes', <Shirt />], ['v_appear', <Smile />], ['v_holiday', <TreePalm />], ['v_announce', <Megaphone />], ['v_reply', <MessagesSquare />]] },
  { title: 'Izrazi in idiomi', tone: 'amber', secs: [['v_idiom', <Quote />], ['v_explain_idiom', <Drama />], ['v_phr', <Split />], ['v_prep', <Signpost />]] },
  { title: 'Slovnica', tone: 'coral', secs: [['p_brackets', <Brackets />], ['p_dialog', <MessageCircle />], ['p_state', <Layers />], ['p_spell', <SpellCheck />], ['a_test', <CaseSensitive />]] },
  { title: 'Pisanje in razlaga', tone: 'sky', secs: [['v_explain', <Feather />], ['v_write', <PenLine />]] },
]

export function Practice({ nav }: { nav: Nav }) {
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const sel = settings.topics
  const [now] = useState(() => Date.now())
  const toggle = (t: TopicId) => setSettings({ topics: sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t] })
  const statFor = (t: TopicId) => {
    if (t === 'verbs') {
      const learned = VERBS.filter((v) => items['v:' + v.id]?.reps).length
      const d = VERBS.filter((v) => items['v:' + v.id]?.reps && items['v:' + v.id].due <= now).length
      return `${learned}/${VERBS.length}${d ? ` · ${d} zapadlih` : ''}`
    }
    const deck = GRAMMAR.find((g) => g.id === t)!
    const keys = deck.cards.map((c) => `c:${t}/${c.id}`)
    const learned = keys.filter((k) => items[k]?.reps).length
    const d = keys.filter((k) => items[k]?.reps && items[k].due <= now).length
    return `${learned}/${keys.length}${d ? ` · ${d} zapadlih` : ''}`
  }
  const secStat = (sec: string) => {
    const deck = GRAMMAR.find((g) => g.id === 'vocab' || g.cards.some((c) => c.sec === sec))
    const decks = GRAMMAR.filter((g) => g.cards.some((c) => c.sec === sec))
    let n = 0, l = 0
    for (const d of decks.length ? decks : deck ? [deck] : []) for (const c of d.cards) if (c.sec === sec) { n++; if (items[`c:${d.id}/${c.id}`]?.reps) l++ }
    return { n, l }
  }
  const pic = secStat('v_pic')
  const all = sel.length === TOPICS.length
  return (
    <div>
      <motion.h1 className="display" {...enter(0)}>Vaje</motion.h1>
      <motion.p className="lead" {...enter(0.06)}>Izberi teme za pametni trening ali odpri posamezno vrsto nalog.</motion.p>

      <div className="section-title"><span className="h2">Pametni trening</span><button className="btn ghost sm" style={{ height: 30, padding: 0 }} onClick={() => setSettings({ topics: all ? ['verbs'] : TOPICS.map((t) => t.id) })}>{all ? 'Samo glagoli' : 'Vse skupaj'}</button></div>
      <motion.div className="tchips" {...enter(0.08)}>
        {TOPICS.map((t) => {
          const on = sel.includes(t.id)
          return (
            <button key={t.id} className={'tchip' + (on ? ' on' : '')} onClick={() => toggle(t.id)} aria-pressed={on}>
              <span className="tchip-c">{on && <Check />}</span>
              <span className="tchip-m"><b>{t.name}</b><span className="num">{statFor(t.id)}</span></span>
            </button>
          )
        })}
      </motion.div>
      <motion.button className="btn hero w" style={{ marginTop: 14 }} disabled={!sel.length} {...enter(0.3)} onClick={() => {
        const q = buildSmart(items, settings, profile, sel)
        if (q.length) nav.start(q, sel.length === TOPICS.length ? 'Vse skupaj' : sel.length === 1 ? TOPICS.find((t) => t.id === sel[0])!.name : 'Izbrane vaje', true)
        else nav.toast('Za izbrane teme danes ni ničesar več. Izberi nalogo spodaj.')
      }}><Sparkles /><span>{sel.length === TOPICS.length ? 'Začni vse skupaj' : 'Začni izbrano'}</span></motion.button>

      <div className="section-title"><span className="h2">Besede s slikami</span><span className="small muted">z učnih listov</span></div>
      <div className="feat2">
        <motion.button className="feat feat-pic" {...enter(0.1)} onClick={() => nav.start(buildSecDrill('v_pic', items, 12), 'Poimenuj sliko')}>
          <span className="feat-art" aria-hidden="true">{['jumper', 'tent', 'ferry', 'freckles'].map((id) => <PicImg key={id} id={id} size={44} />)}</span>
          <b>Poimenuj sliko</b><span>{pic.l}/{pic.n} besed</span>
        </motion.button>
        <motion.button className="feat feat-xw" {...enter(0.14)} onClick={nav.cross}>
          <span className="feat-art grid" aria-hidden="true">{'S.T.UNHAT.E..T'.split('').concat([' ']).slice(0, 9).map((c, i) => <i key={i} className={c === '.' ? 'blk' : ''}>{c === '.' ? '' : c}</i>)}</span>
          <b>Križanka</b><span>{profile.xwBest ? `rekord ${profile.xwBest} besed` : 'slike in namigi z listov'}</span>
        </motion.button>
      </div>

      <div className="section-title"><span className="h2">Naloge s testa</span><span className="small muted">Mock test in učni listi</span></div>
      {SEC_GROUPS.map((g, gi) => (
        <motion.div key={g.title} className={'secgroup tone-' + g.tone} {...enter(0.06 + gi * 0.04)}>
          <div className="secgroup-h">{g.title}</div>
          <div className="glass list">
            {g.secs.filter(([sec]) => SEC_NAME[sec]).map(([sec, icon]) => {
              const [name, desc] = SEC_NAME[sec]
              const st = sec === 'v_explain' || sec === 'v_write' ? null : secStat(sec)
              return (
                <button key={sec} className="secrow" onClick={() => {
                  if (sec !== 'v_explain' && sec !== 'v_write') void topUpTests(items, 1, [sec])
                  nav.start(buildSecDrill(sec, items), name)
                }}>
                  <span className="secrow-ico">{icon}</span>
                  <span className="secrow-main"><b>{name}</b><span>{desc}</span></span>
                  {st && st.n > 0 && <span className="secrow-n num">{st.l}/{st.n}</span>}
                  <ChevronRight className="secrow-go" />
                </button>
              )
            })}
          </div>
        </motion.div>
      ))}

      <div className="section-title"><span className="h2">Naloge za glagole</span><span className="small muted">{TASKS.length} vrst</span></div>
      <div className="tasks">
        {TASKS.filter((t) => (t.id !== 'listen' && t.id !== 'dictate') || canSpeak()).map((t, i) => (
          <motion.button key={t.id} className="task" {...enter(0.05 + i * 0.03)} onClick={() => {
            if (t.id === 'sprint') return nav.sprint()
            nav.start(buildVerbDrill(t.id, items, settings, profile), t.name)
          }}>
            {t.icon}<div><b>{t.name}</b><span>{t.desc}</span></div>
          </motion.button>
        ))}
        <motion.button className="task wide" {...enter(0.4)} onClick={() => nav.start(buildPlacement(profile, items, settings), 'Uvrstitev')}>
          <Gauge /><div><b>Ponovi uvrstitev</b><span>če se ti zdi, da so glagoli prelahki ali pretežki</span></div>
        </motion.button>
      </div>
    </div>
  )
}

/* ───────────────────────── GLAGOLI ───────────────────────── */
type Filter = 'all' | 'hard' | 'weak' | 'learn' | 'young' | 'mature' | 'new'
export function Verbs({ nav }: { nav: Nav }) {
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const theta = useStore((s) => s.profile.theta)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const counts = useMemo(() => {
    const c = { learn: 0, young: 0, mature: 0, new: 0, weak: 0, hard: 0 }
    VERBS.forEach((v) => {
      const s = items['v:' + v.id]
      c[maturity(s)]++
      if (isWeak(s)) c.weak++
      if (!s?.reps && pSuccess(theta, PRIOR[v.id]) < 0.5) c.hard++
    })
    return c
  }, [items, theta])
  const nq = norm(q)
  let list = VERBS.filter((v) => !nq || v.id.includes(nq) || v.slo.toLowerCase().includes(nq) || [...v.accept.past, ...v.accept.pp].some((x) => x.includes(nq)))
  if (nq) list = list.slice().sort((a, b) => Number(b.id === nq) - Number(a.id === nq) || Number(b.id.startsWith(nq)) - Number(a.id.startsWith(nq)))
  if (filter === 'weak') list = list.filter((v) => isWeak(items['v:' + v.id])).sort((a, b) => weakness(items['v:' + b.id]) - weakness(items['v:' + a.id]))
  else if (filter === 'hard') list = list.filter((v) => !items['v:' + v.id]?.reps && pSuccess(theta, PRIOR[v.id]) < 0.5).sort((a, b) => PRIOR[b.id] - PRIOR[a.id])
  else if (filter !== 'all') list = list.filter((v) => maturity(items['v:' + v.id]) === filter)
  const chip = (id: Filter, t: string) => <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{t}</button>
  return (
    <div>
      <motion.h1 className="display" {...enter(0)}>Glagoli</motion.h1>
      <motion.p className="lead" {...enter(0.06)}>{VERBS.length} glagolov z lista Gozdnega sklada in učiteljičinega lista za test, vsak s svojim spominom.</motion.p>
      <div className="search-wrap">
        <Search />
        <input className="search" placeholder="Išči: swim, plavati, swum" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Išči glagol" />
      </div>
      <div className="chips">
        {chip('all', 'Vsi')}
        {chip('hard', `Težki zame ${counts.hard}`)}
        {chip('weak', `Šibki ${counts.weak}`)}
        {chip('learn', `Učim se ${counts.learn}`)}
        {chip('young', `Utrjujem ${counts.young}`)}
        {chip('mature', `Obvladam ${counts.mature}`)}
        {chip('new', `Novi ${counts.new}`)}
      </div>
      {list.length > 1 && (
        <button className="btn w sm" style={{ marginTop: 14 }} onClick={() => nav.start(shuffle(list.slice(0, 25)).map((v) => verbItem(v, 'forms', items, settings)), 'Izbor glagolov')}>
          <Play />Vadi teh {Math.min(25, list.length)}
        </button>
      )}
      <div className="glass list" style={{ marginTop: 12 }}>
        {list.length ? list.map((v) => <VerbRow key={v.id} v={v} c={items['v:' + v.id]} showErr={filter === 'weak'} onOpen={nav.openVerb} theta={theta} />) : <div className="empty">Ni zadetkov za »{q}«.</div>}
      </div>
    </div>
  )
}

/* ───────────────────────── NAPREDEK ───────────────────────── */
export function Progress({ nav }: { nav: Nav }) {
  const items = useStore((s) => s.items)
  const profile = useStore((s) => s.profile)
  const [now] = useState(() => Date.now())
  const days = Array.from({ length: 14 }, (_, i) => { const d = dayOffset(i - 13); return { d, v: profile.days[d] || { n: 0, c: 0, t: 0 } } })
  const mx = Math.max(10, ...days.map((x) => x.v.n))
  const acc = profile.total ? Math.round((profile.correct / profile.total) * 100) : 0
  const tot = { inf: 0, past: 0, pp: 0 }
  Object.entries(items).forEach(([k, c]) => { if (k.startsWith('v:')) (['inf', 'past', 'pp'] as const).forEach((f) => (tot[f] += c.errs?.[f] || 0)) })
  const worst = Math.max(tot.inf, tot.past, tot.pp)
  const week = Array.from({ length: 7 }, (_, i) => {
    const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + i + 1)
    return { n: Object.values(items).filter((c) => c.reps && c.due >= s.getTime() && c.due < s.getTime() + 864e5).length, d: s }
  })
  const wmx = Math.max(5, ...week.map((w) => w.n))
  const weakest = VERBS.filter((v) => isWeak(items['v:' + v.id])).sort((a, b) => weakness(items['v:' + b.id]) - weakness(items['v:' + a.id])).slice(0, 8)
  const learned = Object.values(items).filter((c) => c.reps)
  const avgR = learned.length ? Math.round((learned.reduce((a, c) => a + retrievability(c, now), 0) / learned.length) * 100) : 0
  const DOW = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob']
  return (
    <div>
      <motion.h1 className="display" {...enter(0)}>Napredek</motion.h1>
      <motion.p className="lead" {...enter(0.06)}>
        {profile.total ? <>Raven <b>{levelOf(profile.theta)}</b>, rating <b>{rating(profile.theta)}</b>. Danes bi se spomnil približno <b>{avgR} %</b> naučenega. Skupaj <b>{profile.total}</b> odgovorov, <b>{acc} %</b> pravilnih.</> : <>Ko začneš, se tu pokaže, kako raste tvoj spomin.</>}
      </motion.p>
      <motion.div className="glass block" {...enter(0.1)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="h3">Zadnjih 14 dni</span><span className="small muted">niz {profile.streak} · rekord {profile.best}</span></div>
        <div className="chart" role="img" aria-label="Odgovori v zadnjih 14 dneh">
          {days.map((x, i) => (
            <div key={x.d} className={'col' + (x.d === today() ? ' today' : '')}>
              <motion.div className="bar" initial={{ height: 0 }} animate={{ height: `${(x.v.n / mx) * 100}%` }} transition={{ ...spring, duration: 0.9, delay: 0.15 + i * 0.03 }}>
                <i style={{ height: `${x.v.n ? (x.v.c / x.v.n) * 100 : 0}%` }} />
              </motion.div>
              <div className="d">{+x.d.slice(8)}</div>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.div className="glass block" {...enter(0.16)}>
        <span className="h3">Kje padaš pri glagolih</span>
        <div className="formerr">
          {(['inf', 'past', 'pp'] as const).map((f) => <div key={f} className={tot[f] === worst && worst > 0 ? 'hi' : ''}><b>{tot[f]}</b><span>{f === 'inf' ? 'nedoločnik' : f === 'past' ? 'preteklik' : 'deležnik'}</span></div>)}
        </div>
      </motion.div>
      <motion.div className="glass block" {...enter(0.22)}>
        <span className="h3">Ponovitve v prihodnjem tednu</span>
        <div className="chart" style={{ height: 96 }}>
          {week.map((w, i) => <div key={i} className="col"><motion.div className="bar" initial={{ height: 0 }} animate={{ height: `${(w.n / wmx) * 100}%` }} transition={{ ...spring, delay: 0.2 + i * 0.04 }} style={{ background: 'var(--ink-mute)' }} /><div className="d">{DOW[w.d.getDay()]}</div></div>)}
        </div>
      </motion.div>
      {weakest.length > 0 && (
        <>
          <div className="section-title"><span className="h2">Najtrši zate</span></div>
          <div className="glass list">{weakest.map((v) => <VerbRow key={v.id} v={v} c={items['v:' + v.id]} showErr onOpen={nav.openVerb} theta={profile.theta} />)}</div>
          <p className="small muted" style={{ marginTop: 12 }}>Naslednji na vrsti: {VERB_BY_ID[weakest[0].id].id}, čez {fmtDue(items['v:' + weakest[0].id].due)}.</p>
        </>
      )}
    </div>
  )
}
