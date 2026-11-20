import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { NotebookPen, ListChecks, Table2, ChartNoAxesColumn, Volume2, Play } from 'lucide-react'
import { VERB_BY_ID, family, TYPE_TXT, FORM_SL, type Verb } from '../lib/verbs'
import { maturity, retrievability, fmtDue, type MemState } from '../lib/fsrs'
import { useStore } from '../lib/store'
import { canSpeak, speakVerb } from '../lib/speech'
import { PRIOR, pSuccess } from '../lib/adaptive'
import { sfx } from '../lib/sound'

export const spring = { duration: 0.5, ease: 'easeOut' as const }

export type Tab = 'today' | 'practice' | 'verbs' | 'progress'
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <NotebookPen /> },
  { id: 'practice', label: 'Practice', icon: <ListChecks /> },
  { id: 'verbs', label: 'Verbs', icon: <Table2 /> },
  { id: 'progress', label: 'Progress', icon: <ChartNoAxesColumn /> },
]
export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <motion.nav className="tabbar" aria-label="Main navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: 'easeOut' as const, delay: 0.3 }}>
      {TABS.map((t) => (
        <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => { if (t.id !== tab) sfx.tap(); onTab(t.id) }} aria-current={tab === t.id ? 'page' : undefined}>
          {tab === t.id && <motion.span layoutId="tabbg" className="tab-bg" transition={{ duration: 0.45, ease: 'easeOut' as const }} />}
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </motion.nav>
  )
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div key="sheet" className="sheet" role="dialog" aria-modal="true" aria-label={label}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.5, ease: 'easeOut' as const }}
            drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 550) onClose() }}>
            {/* only the handle can be dragged, so the content scrolls normally on phones too */}
            <div className="grab-zone" onPointerDown={(e) => controls.start(e)}><div className="grab" /></div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function VerbRow({ v, c, showErr, onOpen, theta }: { v: Verb; c?: MemState; showErr?: boolean; onOpen: (id: string) => void; theta: number }) {
  const m = maturity(c)
  const R = c?.reps ? Math.round(retrievability(c) * 100) : null
  const errs = c ? (c.errs?.inf || 0) + (c.errs?.past || 0) + (c.errs?.pp || 0) : 0
  const hard = pSuccess(theta, PRIOR[v.id]) < 0.5
  return (
    <button className="li" onClick={() => onOpen(v.id)}>
      <span className={'mdot ' + m} />
      <span className="li-main">
        <span className="li-t" lang="en">{v.id} <em>· {v.shown.past.join('/')} · {v.shown.pp.join('/')}</em></span>
        <span className="li-s">
          {v.slo}
          {showErr && errs > 0 && <span className="badge bad">{errs}× mistake</span>}
          {c && c.lapses >= 3 && <span className="badge bad">tough nut</span>}
          {!c?.reps && hard && <span className="badge">hard</span>}
        </span>
      </span>
      <span className="li-r">{R === null ? '' : R + ' %'}{R !== null && <span className="minibar"><i style={{ width: `${R}%` }} /></span>}</span>
    </button>
  )
}

export function VerbDetail({ id, onPractice }: { id: string; onPractice: (id: string) => void }) {
  const v = VERB_BY_ID[id]
  const c = useStore((s) => s.items['v:' + id])
  const theta = useStore((s) => s.profile.theta)
  if (!v) return null
  const m = maturity(c)
  const fam = family(v)
  const MT = { new: 'New', learn: 'Learning', young: 'Strengthening', mature: 'Mastered' }
  const p = Math.round(pSuccess(theta, PRIOR[id]) * 100)
  return (
    <div>
      <div className="muted small">{v.slo} · {TYPE_TXT[v.type]}</div>
      <motion.div className="forms" style={{ fontSize: 42, marginTop: 10 }} lang="en" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        {v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}
      </motion.div>
      <div className="small muted" style={{ marginTop: 8 }} lang="en">{v.third} · {v.ing}</div>
      {v.note && <p className="small" style={{ color: 'var(--amber)' }}>{v.note}</p>}
      <div className="kv">
        <div><b>{MT[m]}</b><span>status</span></div>
        <div><b>{c?.reps ? Math.round(retrievability(c) * 100) + ' %' : `${p} %`}</b><span>{c?.reps ? 'recall probability' : 'estimate that you know it'}</span></div>
        <div><b>{c?.reps ? fmtDue(c.due) : '–'}</b><span>next review</span></div>
        <div><b>{c ? `${c.correct}/${c.seen}` : '0/0'}</b><span>correct</span></div>
      </div>
      {c && c.seen > 0 && (
        <div className="formerr">
          {(['inf', 'past', 'pp'] as const).map((f) => <div key={f} className={(c.errs?.[f] || 0) > 0 ? 'hi' : ''}><b>{c.errs?.[f] || 0}</b><span>mistakes: {FORM_SL[f]}</span></div>)}
        </div>
      )}
      {fam.length > 0 && <p className="small" style={{ marginTop: 16, color: 'var(--ink-2)' }}><b>Same pattern:</b> {fam.map((x) => `${x.shown.inf[0]} ${x.shown.past[0]} ${x.shown.pp[0]}`).join(' · ')}</p>}
      <div className="row" style={{ marginTop: 20 }}>
        {canSpeak() && <button className="btn" onClick={() => speakVerb(v.id, [v.shown.inf[0], v.shown.past.join(' or '), v.shown.pp.join(' or ')].join(', '))}><Volume2 />Pronounce</button>}
        <button className="btn primary" onClick={() => onPractice(id)}><Play />Practise now</button>
      </div>
    </div>
  )
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div className="toast" role="status" initial={{ opacity: 0, y: -8, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -8, x: '-50%' }} transition={{ duration: 0.4, ease: 'easeOut' as const }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
