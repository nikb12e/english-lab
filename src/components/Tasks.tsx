// Extra task types modelled on the test: fix the mistake, odd one out, choose the form, explain in English, and the “Why?” button.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Sparkles, Volume2 } from 'lucide-react'
import { sentFor, type QItem } from '../lib/content'
import { VERBS, TYPE_TXT, type Verb } from '../lib/verbs'
import { fakeForm } from '../lib/adaptive'
import { checkForm, lev, norm } from '../lib/check'
import { explainMistake, gradeExplain, gradeWriting, type Grading, type WriteGrade } from '../lib/ai'
import { getState } from '../lib/store'
import { speak, speakVerb, prepare } from '../lib/speech'
import { Kinetic } from './Kinetic'
import { spring, Tag, gradeFor, type Entry, type Result, useReadTask, TaskSay } from './qshared'
import type { ExplainCard, WriteCard } from '../data/types'

type VItem = Extract<QItem, { kind: 'verb' }>
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const trip = (v: Verb) => `${v.shown.inf[0]}, ${v.shown.past.join('/')}, ${v.shown.pp.join('/')}`

/** Button to listen to the whole sentence again (ElevenLabs). */
export function Listen({ text }: { text: string }) {
  return <button className="listen-btn" onClick={() => void speak(text)} aria-label="Listen to the sentence"><Volume2 /></button>
}

/** The “Why?” button: the language model explains exactly the mistake the learner made. */
export function Why({ task, given, correct, ctx }: { task: string; given: string; correct: string; ctx?: string }) {
  const [st, setSt] = useState<'idle' | 'load' | 'done' | 'off'>('idle')
  const [txt, setTxt] = useState('')
  if (!given.trim()) return null
  if (st === 'done') return <motion.p className="why" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>{txt}</motion.p>
  if (st === 'off') return <p className="why muted">The explanation is not available right now. Add your own AI key in Settings to turn it on.</p>
  return (
    <button className="btn ghost sm why-btn" disabled={st === 'load'} onClick={async () => {
      setSt('load')
      const r = await explainMistake(task, given, correct, ctx)
      if (r?.text) { setTxt(r.text); setSt('done') } else setSt('off')
    }}><Sparkles />{st === 'load' ? 'Thinking …' : 'Why is it wrong?'}</button>
  )
}

function wrongFor(v: Verb, form: 'past' | 'pp') {
  const other = form === 'pp' ? v.shown.past[0] : v.shown.pp[0]
  if (!v.accept[form].has(other)) return other
  return fakeForm(v, form)
}

/* ───────── fix the mistake ───────── */
export function FixQ({ entry, onAnswer, onOverride, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const s = useMemo(() => sentFor(entry.uid, v.id), [entry.uid, v.id])
  const [, form, text, sl] = s
  const wrong = useMemo(() => wrongFor(v, form), [v, form])
  useEffect(() => { if (getState().settings.speech) void prepare(text.replace('___', v.shown[form][0])) }, [text, form, v])
  useReadTask(text)
  const [val, setVal] = useState('')
  const [res, setRes] = useState<null | boolean>(null)
  const [over, setOver] = useState(false)
  const t0 = useRef(Date.now())
  const inp = useRef<HTMLInputElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { const t = setTimeout(() => inp.current?.focus({ preventScroll: true }), 120); return () => clearTimeout(t) }, [])
  const submit = (gaveUp = false) => {
    if (res !== null) return
    if (!gaveUp && !val.trim()) return
    const ok = !gaveUp && checkForm(val, v.accept[form]).ok
    setRes(ok)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.5, 0), errFields: ok ? [] : [form], secs })
    // the correct sentence is always read out (even after a mistake) so you hear the right form in context
    if (getState().settings.speech) setTimeout(() => speak(text.replace('___', v.shown[form][0])), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const [a, b] = text.split('___')
  const good = !!res || over
  const near = res === false && v.shown[form].some((x) => lev(norm(val), x) === 1)
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={text} /></span><span>Fix the mistake</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>
        {a}<span className={'fixw' + (res !== null ? ' shown' : '')}>{wrong}</span>{b}
      </div>
      <div className="qhint" style={{ marginTop: 10 }}>One verb form in the sentence is wrong. Write the correct one.</div>
      <div className="fields">
        <Kinetic ref={inp} value={val} onChange={setVal} onEnter={() => (res === null ? submit() : onNext())} status={res === null ? 'idle' : good ? 'ok' : 'bad'} correct={v.shown[form].join('/')} ariaLabel="Correct form" />
      </div>
      <AnimatePresence>
        {res !== null && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>
            <h3>{good ? 'You found the mistake' : 'Not yet'}<Listen text={text.replace('___', v.shown[form][0])} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            <p>“{wrong}” is {v.accept.past.has(wrong) ? 'past simple' : v.accept.pp.has(wrong) ? 'the participle' : 'a form that does not exist'}, but here you need {form === 'past' ? 'past simple' : 'the past participle (after have/has/had or in the passive)'}. In Slovenian: {sl}.</p>
            {near && !over && <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 5 }) }}>Typo, count it as correct</button>}
            {!good && <Why task={`Fix the wrong verb form in the sentence: ${a}${wrong}${b}`} given={val} correct={v.shown[form].join('/')} ctx={`verb ${trip(v)}`} />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {res === null ? (
          <><button className="btn sm" onClick={() => submit(true)}>I don't know</button><button className="btn sm primary" onClick={() => submit()}>Check</button></>
        ) : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button>}
      </div>
    </div>
  )
}

/* ───────── choose the form in a sentence ───────── */
export function PickQ({ entry, onAnswer, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const s = useMemo(() => sentFor(entry.uid, v.id), [entry.uid, v.id])
  const [, form, text, sl] = s
  const opts = useMemo(() => {
    const right = v.shown[form][0]
    const set = new Set([right])
    const o = [right]
    const other = form === 'pp' ? v.shown.past[0] : v.shown.pp[0]
    if (!v.accept[form].has(other) && !set.has(other)) { o.push(other); set.add(other) }
    for (let g = 0; o.length < 3 && g < 20; g++) { const f = fakeForm(v, form); if (!set.has(f) && !v.accept[form].has(f)) { o.push(f); set.add(f) } }
    if (o.length < 3 && !set.has(v.shown.inf[0]) && !v.accept[form].has(v.shown.inf[0])) o.push(v.shown.inf[0])
    return shuffle(o)
  }, [v, form])
  const [pick, setPick] = useState<number | null>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (getState().settings.speech) void prepare(text.replace('___', v.shown[form][0])) }, [text, form, v])
  useReadTask(text, v.id)
  const choose = (i: number) => {
    if (pick !== null) return
    setPick(i)
    const ok = v.accept[form].has(opts[i])
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1, 0), errFields: ok ? [] : [form], secs })
    if (getState().settings.speech) setTimeout(() => speak(text.replace('___', v.shown[form][0])), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const [a, b] = text.split('___')
  const ok = pick !== null && v.accept[form].has(opts[pick])
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={text} hint={v.id} /></span><span>Choose the form</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>
        {a}<span className={'gap' + (pick === null ? '' : ok ? ' ok' : ' bad')}>{pick === null ? ' ' : v.shown[form][0]}</span>{b}
      </div>
      <div className="qhint" style={{ marginTop: 8 }}>({v.id}) · {sl}</div>
      <div className="choices">
        {opts.map((o, i) => (
          <motion.button key={o} className={'choice' + (pick === null ? '' : v.accept[form].has(o) ? ' ok' : i === pick ? ' bad' : ' dim')} onClick={() => choose(i)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 + i * 0.05 }}>
            <span className="key">{pick !== null && v.accept[form].has(o) ? <Check size={15} /> : i + 1}</span><span lang="en">{o}</span>
          </motion.button>
        ))}
      </div>
      {pick !== null && (
        <>
          <motion.div className={'result ' + (ok ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{ok ? 'Correct' : 'Not yet'}<Listen text={text.replace('___', v.shown[form][0])} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            <p>{form === 'pp' ? 'After have/has/had or in the passive we use the past participle.' : 'The event is finished in the past (a time signal), so past simple.'}</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── odd one out (patterns) ───────── */
export function OddQ({ entry, onAnswer, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const opts = useMemo(() => {
    const items = getState().items
    const types = (['AAA', 'ABB', 'ABC'] as const).filter((t) => t !== v.type)
    const t = types[Math.floor(Math.random() * types.length)]
    const pool = VERBS.filter((x) => x.type === t && x.id !== v.id)
    const known = pool.filter((x) => items['v:' + x.id]?.reps)
    const src = known.length >= 3 ? known : pool
    return shuffle([v, ...shuffle(src).slice(0, 3)])
  }, [v])
  const [pick, setPick] = useState<number | null>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  const choose = (i: number) => {
    if (pick !== null) return
    setPick(i)
    const ok = opts[i].id === v.id
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.6, 0), secs })
    if (getState().settings.speech) setTimeout(() => speakVerb(v.id, trip(v)), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const odd = opts.find((x) => x.id !== v.id)
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Odd one out</span></div>
      <div className="qword long" style={{ marginTop: 18 }}>Three verbs share the same pattern of forms. Which one is different?</div>
      <div className="choices">
        {opts.map((o, i) => (
          <motion.button key={o.id} className={'choice' + (pick === null ? '' : o.id === v.id ? ' ok' : i === pick ? ' bad' : ' dim')} onClick={() => choose(i)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 + i * 0.05 }}>
            <span className="key">{pick !== null && o.id === v.id ? <Check size={15} /> : i + 1}</span>
            <span lang="en" style={{ flex: 1 }}>{pick === null ? o.id : trip(o)}</span>
            {pick !== null && <span className="ptag">{o.type}</span>}
          </motion.button>
        ))}
      </div>
      {pick !== null && (
        <>
          <motion.div className={'result ' + (opts[pick].id === v.id ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{opts[pick].id === v.id ? 'Correct' : 'Not yet'}</h3>
            <p><b lang="en">{v.id}</b>: {TYPE_TXT[v.type]}. The others: {odd ? TYPE_TXT[odd.type] : ''}.</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── explain in English ───────── */
export function ExplainQ({ entry, card, onAnswer, onNext }: { entry: Entry; card: ExplainCard; onAnswer: (r: Result) => void; onNext: () => void }) {
  const [val, setVal] = useState('')
  const [phase, setPhase] = useState<'ask' | 'grading' | 'graded' | 'self' | 'done'>('ask')
  const [g, setG] = useState<Grading | null>(null)
  const t0 = useRef(Date.now())
  const ta = useRef<HTMLTextAreaElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { const t = setTimeout(() => ta.current?.focus({ preventScroll: true }), 120); return () => clearTimeout(t) }, [])
  const finish = (ok: boolean, grade: 1 | 2 | 3) => {
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade, secs })
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const submit = async (gaveUp = false) => {
    if (phase !== 'ask') return
    if (gaveUp || !val.trim()) { setPhase('done'); finish(false, 1); return }
    setPhase('grading')
    const r = await gradeExplain(card.q, card.a, val.trim())
    if (r && typeof r.score === 'number') {
      setG(r); setPhase('graded'); finish(r.score >= 1, r.score >= 2 ? 3 : r.score === 1 ? 2 : 1)
    } else setPhase('self')
  }
  // after submitting it always reads out the correct (model) explanation
  useEffect(() => { if (getState().settings.speech) void prepare(card.a.slice(0, 220)) }, [card.a])
  useEffect(() => {
    if (phase === 'ask' || phase === 'grading' || !getState().settings.speech) return
    void speak((g?.better || card.a).slice(0, 220))
  }, [phase, g, card.a])
  const ok = g ? g.score >= 1 : null
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Explain in English</span></div>
      <div className="qword" lang="en">{card.q}</div>
      <div className="qhint">Explain in English, in one sentence. Stick to the topic of holidays or describing people.</div>
      <textarea ref={ta} className="field area" lang="en" rows={3} value={val} disabled={phase !== 'ask'} placeholder="It means …"
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }} aria-label="Explanation in English" />
      <AnimatePresence>
        {(phase === 'graded' || phase === 'done' || phase === 'self') && (
          <motion.div className={'result ' + (phase === 'graded' ? (ok ? 'good' : 'bad') : phase === 'done' ? 'bad' : 'neutral')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            <h3>{phase === 'graded' ? (g!.score === 2 ? 'Excellent explanation' : g!.score === 1 ? 'Partly correct' : 'Not yet') : phase === 'done' ? 'Model explanation' : 'Compare yourself'}</h3>
            {g?.feedback && <p>{g.feedback}</p>}
            <p lang="en"><b>Pattern:</b> {g?.better || card.a}</p>
            {phase === 'self' && (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => { setPhase('done'); finish(false, 1) }}>I didn't know it</button>
                <button className="btn sm primary" onClick={() => { setPhase('done'); finish(true, 3) }}>I knew it</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {phase === 'ask' ? (
          <><button className="btn sm" onClick={() => void submit(true)}>I don't know</button><button className="btn sm primary" onClick={() => void submit()}>Grade</button></>
        ) : phase === 'grading' ? <button className="btn sm primary" disabled>Grading …</button>
          : phase === 'self' ? null
            : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button>}
      </div>
    </div>
  )
}

/* ───────── written composition ───────── */
export function WriteQ({ entry, card, onAnswer, onNext }: { entry: Entry; card: WriteCard; onAnswer: (r: Result) => void; onNext: () => void }) {
  const [val, setVal] = useState('')
  const [phase, setPhase] = useState<'ask' | 'grading' | 'graded' | 'self' | 'done'>('ask')
  const [g, setG] = useState<WriteGrade | null>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  const sentences = val.split(/[.!?]+\s/).filter((x) => x.trim().split(/\s+/).length >= 3).length + (/[.!?]\s*$/.test(val.trim()) ? 0 : 0)
  const words = val.trim() ? val.trim().split(/\s+/).length : 0
  const finish = (score: number) => {
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok: score >= 6, grade: score >= 8 ? 3 : score >= 6 ? 2 : 1, secs })
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const submit = async () => {
    if (phase !== 'ask' || words < 15) return
    setPhase('grading')
    const r = await gradeWriting(card.q, card.brief, val.trim())
    if (r && typeof r.score === 'number') { setG(r); setPhase('graded'); finish(r.score) } else setPhase('self')
  }
  // after grading it reads out an improved version of your sentences
  useEffect(() => {
    if (phase !== 'graded' || !g?.better || !getState().settings.speech) return
    const parts = g.better.match(/[^.!?]+[.!?]*/g) || [g.better]
    let t = ''
    for (const x of parts) { if ((t + x).length > 220) break; t += x }
    void speak((t || g.better.slice(0, 220)).trim())
  }, [phase, g])
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Writing</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 18 }}>{card.q}</div>
      <div className="qhint">{card.brief}</div>
      <textarea className="field area big" lang="en" rows={8} value={val} disabled={phase !== 'ask'} placeholder="Write here …" onChange={(e) => setVal(e.target.value)} aria-label="Essay" />
      <div className="wcount"><span className={sentences >= card.min ? 'ok' : ''}>{sentences} / {card.min} to {card.max} sentences</span><span>{words} words</span></div>
      <AnimatePresence>
        {phase === 'graded' && g && (
          <motion.div className={'result ' + (g.score >= 6 ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            <h3>{g.score}/10 points</h3>
            <div className="wbars">
              {([['Content', g.content], ['Vocabulary', g.vocab], ['Grammar', g.grammar]] as const).map(([k, t]) => <p key={k}><b>{k}:</b> {t}</p>)}
            </div>
            {g.fixes?.length > 0 && <div className="wfix">{g.fixes.slice(0, 6).map((f, i) => <div key={i}><s lang="en">{f.wrong}</s> → <b lang="en">{f.right}</b><small>{f.why}</small></div>)}</div>}
            {g.better && <p lang="en"><b>Better version:</b> {g.better}</p>}
          </motion.div>
        )}
        {phase === 'self' && (
          <motion.div className="result neutral" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>Grade yourself</h3>
            <p>Grading is not available right now. Check: did you answer the question, use words from the worksheet and the right tenses?</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => { setPhase('done'); finish(4) }}>Poor</button>
              <button className="btn sm primary" onClick={() => { setPhase('done'); finish(8) }}>Good</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {phase === 'ask' ? <button className="btn sm primary" disabled={words < 15} onClick={() => void submit()}>{words < 15 ? 'Write at least 15 words' : 'Submit for grading'}</button>
          : phase === 'grading' ? <button className="btn sm primary" disabled>The teacher is reading …</button>
            : phase === 'self' ? null
              : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button>}
      </div>
    </div>
  )
}
