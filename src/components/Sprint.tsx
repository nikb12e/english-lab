import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { VERBS, type Verb } from '../lib/verbs'
import { checkForm } from '../lib/check'
import { getState, updateProfile } from '../lib/store'
import { haptic } from '../lib/speech'
import { sfx } from '../lib/sound'
import { PRIOR, pSuccess } from '../lib/adaptive'
import { Kinetic } from './Kinetic'

const DURATION = 60
type Q = { v: Verb; f: 'past' | 'pp' }

// The quick round picks verbs around your level and slightly above it.
function pick(prev?: Q): Q {
  const th = getState().profile.theta
  const pool = VERBS.filter((v) => { const p = pSuccess(th, PRIOR[v.id]); return p > 0.25 && p < 0.92 })
  const p = pool.length > 20 ? pool : VERBS
  let q: Q
  do q = { v: p[Math.floor(Math.random() * p.length)], f: Math.random() < 0.5 ? 'past' : 'pp' }
  while (prev && q.v === prev.v)
  return q
}

export function Sprint({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'run' | 'end'>('ready')
  const [left, setLeft] = useState(DURATION)
  const [q, setQ] = useState<Q>(() => pick())
  const [val, setVal] = useState('')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [miss, setMiss] = useState<{ q: Q; a: string }[]>([])
  const [flash, setFlash] = useState<null | boolean>(null)
  const inp = useRef<HTMLInputElement>(null)
  const best = getState().profile.sprintBest || 0

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => {
    if (phase !== 'run') return
    const t0 = Date.now()
    const id = setInterval(() => {
      const l = Math.max(0, DURATION - (Date.now() - t0) / 1000)
      setLeft(l)
      if (l === 0) { clearInterval(id); setPhase('end'); sfx.finish() }
    }, 100)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => { if (phase === 'end') updateProfile((p) => ({ ...p, sprintBest: Math.max(p.sprintBest || 0, score) })) }, [phase, score])

  const start = () => { setPhase('run'); setScore(0); setStreak(0); setMiss([]); setLeft(DURATION); setQ(pick()); setVal(''); setTimeout(() => inp.current?.focus(), 80) }
  const submit = () => {
    if (!val.trim() || flash !== null) return
    const ok = checkForm(val, q.v.accept[q.f]).ok
    haptic(ok ? 'ok' : 'bad')
    if (ok) { setScore((s) => s + 1); setStreak((s) => s + 1); sfx.ok(streak + 1) } else { setMiss((m) => [...m, { q, a: val }]); setStreak(0); sfx.bad() }
    setFlash(ok)
    setTimeout(() => { setFlash(null); setVal(''); setQ((p) => pick(p)); inp.current?.focus() }, ok ? 280 : 1100)
  }

  return (
    <motion.div className="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="s-inner">
        <div className="s-top">
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X /></button>
          {phase === 'run' && <div className="track"><i style={{ width: `${(left / DURATION) * 100}%`, transition: 'width .1s linear' }} /></div>}
          {phase === 'run' && <div className={'combo' + (streak >= 5 ? ' hot' : '')}>{score}</div>}
        </div>
        {phase === 'ready' && (
          <motion.div className="qcard glass" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="qmeta"><span className="k fresh">Quick round</span><span>60 seconds</span></div>
            <div className="qword">How many forms in a minute?</div>
            <p className="lead">A verb and a form, you type. The verbs are picked around your level. Record: <b>{best}</b>.</p>
            <div className="s-actions"><button className="btn hero w" onClick={start}><Zap /><span>Start</span></button></div>
          </motion.div>
        )}
        {phase === 'run' && (
          <div className="qcard glass">
            <div className="qmeta"><span className="k review">{q.f === 'past' ? 'Past simple' : 'Past participle'}</span><span className="num">{Math.ceil(left)} s</span></div>
            <AnimatePresence mode="wait">
              <motion.div key={q.v.id + q.f} className="qword" lang="en" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: 'easeOut' as const }}>{q.v.id}</motion.div>
            </AnimatePresence>
            <div className="qhint">{q.v.slo}</div>
            <div className="fields">
              <Kinetic ref={inp} value={val} onChange={setVal} onEnter={submit} status={flash === null ? 'idle' : flash ? 'ok' : 'bad'} correct={q.v.shown[q.f].join(' / ')} enterKeyHint="go" ariaLabel="Form" />
            </div>
          </div>
        )}
        {phase === 'end' && (
          <motion.div className="qcard glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: 'easeOut' as const }}>
            <div className="qmeta"><span className="k place">End</span><span>{score > best ? 'New record' : `Record ${Math.max(best, score)}`}</span></div>
            <div className="big num">{score}<small> forms</small></div>
            {miss.length > 0 && (
              <div className="list glass" style={{ borderRadius: 20, marginTop: 20 }}>
                {miss.slice(0, 10).map((m, i) => <div className="li" key={i}><div className="li-main"><span className="li-t">{m.q.v.id} <em>· {m.q.v.shown[m.q.f].join('/')}</em></span><span className="li-s">You wrote “{m.a}”</span></div></div>)}
              </div>
            )}
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={onClose}>Finish</button>
              <button className="btn primary" onClick={start}>Once more</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
