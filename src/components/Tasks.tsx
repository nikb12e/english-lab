// Dodatni tipi nalog po vzoru testa: popravi napako, kateri ne spada, izberi obliko, razloži v angleščini, in gumb »Zakaj?«.
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

/** Gumb za ponovno poslušanje cele povedi (ElevenLabs). */
export function Listen({ text }: { text: string }) {
  return <button className="listen-btn" onClick={() => void speak(text)} aria-label="Poslušaj poved"><Volume2 /></button>
}

/** Gumb »Zakaj?«: jezikovni model razloži prav to napako, ki jo je naredil učenec. */
export function Why({ task, given, correct, ctx }: { task: string; given: string; correct: string; ctx?: string }) {
  const [st, setSt] = useState<'idle' | 'load' | 'done' | 'off'>('idle')
  const [txt, setTxt] = useState('')
  if (!given.trim()) return null
  if (st === 'done') return <motion.p className="why" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>{txt}</motion.p>
  if (st === 'off') return <p className="why muted">Razlaga zdaj ni na voljo (potrebna je prijava in povezava).</p>
  return (
    <button className="btn ghost sm why-btn" disabled={st === 'load'} onClick={async () => {
      setSt('load')
      const r = await explainMistake(task, given, correct, ctx)
      if (r?.text) { setTxt(r.text); setSt('done') } else setSt('off')
    }}><Sparkles />{st === 'load' ? 'Razmišljam …' : 'Zakaj je narobe?'}</button>
  )
}

function wrongFor(v: Verb, form: 'past' | 'pp') {
  const other = form === 'pp' ? v.shown.past[0] : v.shown.pp[0]
  if (!v.accept[form].has(other)) return other
  return fakeForm(v, form)
}

/* ───────── popravi napako ───────── */
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
    // pravilni stavek se vedno prebere (tudi po napaki), da slišiš pravo obliko v povedi
    if (getState().settings.speech) setTimeout(() => speak(text.replace('___', v.shown[form][0])), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const [a, b] = text.split('___')
  const good = !!res || over
  const near = res === false && v.shown[form].some((x) => lev(norm(val), x) === 1)
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={text} /></span><span>Popravi napako</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>
        {a}<span className={'fixw' + (res !== null ? ' shown' : '')}>{wrong}</span>{b}
      </div>
      <div className="qhint" style={{ marginTop: 10 }}>V stavku je ena napačna glagolska oblika. Napiši pravilno.</div>
      <div className="fields">
        <Kinetic ref={inp} value={val} onChange={setVal} onEnter={() => (res === null ? submit() : onNext())} status={res === null ? 'idle' : good ? 'ok' : 'bad'} correct={v.shown[form].join('/')} ariaLabel="Pravilna oblika" />
      </div>
      <AnimatePresence>
        {res !== null && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>
            <h3>{good ? 'Napako si našel' : 'Še ne'}<Listen text={text.replace('___', v.shown[form][0])} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            <p>»{wrong}« je {v.accept.past.has(wrong) ? 'preteklik' : v.accept.pp.has(wrong) ? 'deležnik' : 'neobstoječa oblika'}, tu pa je potreben {form === 'past' ? 'past simple' : 'past participle (za have/has/had ali trpnik)'}. Slovensko: {sl}.</p>
            {near && !over && <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 5 }) }}>Tipkarska napaka, štej kot pravilno</button>}
            {!good && <Why task={`Popravi napačno glagolsko obliko v stavku: ${a}${wrong}${b}`} given={val} correct={v.shown[form].join('/')} ctx={`glagol ${trip(v)}`} />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {res === null ? (
          <><button className="btn sm" onClick={() => submit(true)}>Ne vem</button><button className="btn sm primary" onClick={() => submit()}>Preveri</button></>
        ) : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>}
      </div>
    </div>
  )
}

/* ───────── izberi obliko v stavku ───────── */
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
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={text} hint={v.id} /></span><span>Izberi obliko</span></div>
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
            <h3>{ok ? 'Pravilno' : 'Še ne'}<Listen text={text.replace('___', v.shown[form][0])} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            <p>{form === 'pp' ? 'Za have/has/had ali v trpniku stoji past participle.' : 'Dogodek je končan v preteklosti (časovni signal), zato past simple.'}</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── kateri ne spada (vzorci) ───────── */
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
      <div className="qmeta"><Tag entry={entry} /><span>Kateri ne spada</span></div>
      <div className="qword long" style={{ marginTop: 18 }}>Trije glagoli imajo enak vzorec oblik. Kateri je drugačen?</div>
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
            <h3>{opts[pick].id === v.id ? 'Pravilno' : 'Še ne'}</h3>
            <p><b lang="en">{v.id}</b>: {TYPE_TXT[v.type]}. Ostali: {odd ? TYPE_TXT[odd.type] : ''}.</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── razloži v angleščini ───────── */
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
  // po oddaji vedno prebere pravilno (vzorčno) razlago
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
      <div className="qhint">Razloži v angleščini, z enim stavkom. Drži se teme počitnic ali opisovanja ljudi.</div>
      <textarea ref={ta} className="field area" lang="en" rows={3} value={val} disabled={phase !== 'ask'} placeholder="It means …"
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }} aria-label="Razlaga v angleščini" />
      <AnimatePresence>
        {(phase === 'graded' || phase === 'done' || phase === 'self') && (
          <motion.div className={'result ' + (phase === 'graded' ? (ok ? 'good' : 'bad') : phase === 'done' ? 'bad' : 'neutral')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            <h3>{phase === 'graded' ? (g!.score === 2 ? 'Odlična razlaga' : g!.score === 1 ? 'Delno pravilno' : 'Še ne') : phase === 'done' ? 'Vzorčna razlaga' : 'Primerjaj sam'}</h3>
            {g?.feedback && <p>{g.feedback}</p>}
            <p lang="en"><b>Vzorec:</b> {g?.better || card.a}</p>
            {phase === 'self' && (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => { setPhase('done'); finish(false, 1) }}>Nisem znal</button>
                <button className="btn sm primary" onClick={() => { setPhase('done'); finish(true, 3) }}>Znal sem</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {phase === 'ask' ? (
          <><button className="btn sm" onClick={() => void submit(true)}>Ne vem</button><button className="btn sm primary" onClick={() => void submit()}>Oceni</button></>
        ) : phase === 'grading' ? <button className="btn sm primary" disabled>Ocenjujem …</button>
          : phase === 'self' ? null
            : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>}
      </div>
    </div>
  )
}

/* ───────── pisni sestavek ───────── */
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
  // po oceni prebere izboljšano različico tvojih stavkov
  useEffect(() => {
    if (phase !== 'graded' || !g?.better || !getState().settings.speech) return
    const parts = g.better.match(/[^.!?]+[.!?]*/g) || [g.better]
    let t = ''
    for (const x of parts) { if ((t + x).length > 220) break; t += x }
    void speak((t || g.better.slice(0, 220)).trim())
  }, [phase, g])
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Pisanje</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 18 }}>{card.q}</div>
      <div className="qhint">{card.brief}</div>
      <textarea className="field area big" lang="en" rows={8} value={val} disabled={phase !== 'ask'} placeholder="Write here …" onChange={(e) => setVal(e.target.value)} aria-label="Sestavek" />
      <div className="wcount"><span className={sentences >= card.min ? 'ok' : ''}>{sentences} / {card.min} do {card.max} povedi</span><span>{words} besed</span></div>
      <AnimatePresence>
        {phase === 'graded' && g && (
          <motion.div className={'result ' + (g.score >= 6 ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            <h3>{g.score}/10 točk</h3>
            <div className="wbars">
              {([['Vsebina', g.content], ['Besedišče', g.vocab], ['Slovnica', g.grammar]] as const).map(([k, t]) => <p key={k}><b>{k}:</b> {t}</p>)}
            </div>
            {g.fixes?.length > 0 && <div className="wfix">{g.fixes.slice(0, 6).map((f, i) => <div key={i}><s lang="en">{f.wrong}</s> → <b lang="en">{f.right}</b><small>{f.why}</small></div>)}</div>}
            {g.better && <p lang="en"><b>Boljša različica:</b> {g.better}</p>}
          </motion.div>
        )}
        {phase === 'self' && (
          <motion.div className="result neutral" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>Oceni sam</h3>
            <p>Ocenjevanje zdaj ni na voljo. Preveri: ali si odgovoril na vprašanje, uporabil besede z učnega lista in pravilne čase?</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => { setPhase('done'); finish(4) }}>Slabo</button>
              <button className="btn sm primary" onClick={() => { setPhase('done'); finish(8) }}>Dobro</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {phase === 'ask' ? <button className="btn sm primary" disabled={words < 15} onClick={() => void submit()}>{words < 15 ? 'Napiši vsaj 15 besed' : 'Oddaj v oceno'}</button>
          : phase === 'grading' ? <button className="btn sm primary" disabled>Učitelj bere …</button>
            : phase === 'self' ? null
              : <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>}
      </div>
    </div>
  )
}
