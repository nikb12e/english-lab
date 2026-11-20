// New, more playful task types: build the sentence (tiles), dictation (listening + spelling) and match pairs.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Ear, Snail, Volume2 } from 'lucide-react'
import { sentFor, type QItem } from '../lib/content'
import { VERBS, type Verb } from '../lib/verbs'
import { fakeForm } from '../lib/adaptive'
import { checkForm } from '../lib/check'
import { getState } from '../lib/store'
import { speak, speakVerb, prepare, prefetchVerb } from '../lib/speech'
import { spring, Tag, gradeFor, type Entry, type Result } from './qshared'
import { Listen, Why } from './Tasks'

type VItem = Extract<QItem, { kind: 'verb' }>
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const speechOn = () => getState().settings.speech
const clean = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '')

// a convincing wrong form for the extra tile (never silly, like “forecastedd”)
function wrongFor(v: Verb, form: 'past' | 'pp') {
  const ok = (w: string) => !!w && !v.accept[form].has(w) && !/(edd|eded|ingg)$/.test(w) && /^[a-z]+$/.test(w)
  const cands = [form === 'pp' ? v.shown.past[0] : v.shown.pp[0], v.shown.inf[0], ...Array.from({ length: 8 }, () => fakeForm(v, form))]
  return cands.find(ok) || (form === 'pp' ? v.shown.inf[0] + 's' : v.shown.inf[0] + 'ing')
}

/* ───────── build the sentence from tiles ───────── */
export function BuildQ({ entry, onAnswer, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const s = useMemo(() => sentFor(entry.uid, v.id), [entry.uid, v.id])
  const [, form, text, sl] = s
  const full = text.replace('___', v.shown[form][0])
  // long sentences: the beginning is already placed, you build the last 9 words at most
  const { fixed, words, tiles } = useMemo(() => {
    const all = full.split(/\s+/)
    const cut = Math.max(0, all.length - 9)
    const ws = all.slice(cut)
    const decoy = wrongFor(v, form)
    const t = shuffle([...ws.map((w, i) => ({ id: 'w' + i, w })), { id: 'x', w: decoy }])
    return { fixed: all.slice(0, cut), words: ws, tiles: t }
  }, [full, v, form])
  const [line, setLine] = useState<string[]>([])
  const [res, setRes] = useState<null | boolean>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (speechOn()) void prepare(full) }, [full])
  const byId = (id: string) => tiles.find((t) => t.id === id)!
  const submit = () => {
    if (res !== null || !line.length) return
    const got = line.map((id) => clean(byId(id).w)).join(' ')
    const want = words.map(clean).join(' ')
    const ok = got === want
    setRes(ok)
    const usedDecoy = line.includes('x')
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 2.2, 0), errFields: ok || !usedDecoy ? [] : [form], secs })
    if (speechOn()) setTimeout(() => speak(full), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Build the sentence</span></div>
      <div className="qhint" style={{ marginTop: 14 }}>Translate: <b>{sl}</b> · verb <b lang="en">{v.id}</b>, one tile is extra.</div>
      <div className={'build-line' + (res === null ? '' : res ? ' ok' : ' bad')} lang="en">
        {fixed.length > 0 && <span className="fixed">{fixed.join(' ')}</span>}
        {line.map((id) => (
          <motion.button layout key={id} className="tile on" disabled={res !== null} onClick={() => setLine((l) => l.filter((x) => x !== id))} transition={spring}>{byId(id).w}</motion.button>
        ))}
        {!line.length && <span className="build-ph">Tap the words in the right order</span>}
      </div>
      <div className="tiles" lang="en">
        {tiles.map((t) => {
          const used = line.includes(t.id)
          return (
            <motion.button layout key={t.id} className={'tile' + (used ? ' ghost' : '')} disabled={used || res !== null} onClick={() => setLine((l) => [...l, t.id])} transition={spring}>{t.w}</motion.button>
          )
        })}
      </div>
      {res === null ? (
        <div className="s-actions"><button className="btn sm" onClick={() => setLine([])}>Clear</button><button className="btn sm primary" disabled={!line.length} onClick={submit}>Check</button></div>
      ) : (
        <>
          <motion.div className={'result ' + (res ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{res ? 'Correct' : 'Correct order'}<Listen text={full} /></h3>
            <p lang="en" className="sent-full">{full}</p>
            <p>{form === 'pp' ? `After have/has/had or in the passive: ${v.shown.pp.join('/')}` : `Finished in the past: ${v.shown.past.join('/')}`}. The extra form was “{byId('x').w}”.</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── dictation: listen to the sentence and write the missing form ───────── */
export function DictateQ({ entry, onAnswer, onOverride, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const s = useMemo(() => sentFor(entry.uid, v.id), [entry.uid, v.id])
  const [, form, text, sl] = s
  const full = text.replace('___', v.shown[form][0])
  const [val, setVal] = useState('')
  const [res, setRes] = useState<null | boolean>(null)
  const [over, setOver] = useState(false)
  const [help, setHelp] = useState(false)
  const t0 = useRef(Date.now())
  const inp = useRef<HTMLInputElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    void prepare(full, true)
    const t = setTimeout(() => { void speak(full, 1); inp.current?.focus({ preventScroll: true }) }, 180)
    return () => clearTimeout(t)
  }, [full])
  const submit = (gaveUp = false) => {
    if (res !== null) return
    if (!gaveUp && !val.trim()) return
    const ok = !gaveUp && checkForm(val, v.accept[form]).ok
    setRes(ok)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.8, help ? 1 : 0), errFields: ok ? [] : [form], secs })
    if (speechOn()) setTimeout(() => speak(full), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const [a, b] = text.split('___')
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Dictation</span></div>
      <div className="dict-btns">
        <button className="dict-play" onClick={() => void speak(full, 1)} aria-label="Play the sentence"><Volume2 /></button>
        <button className="dict-slow" onClick={() => void speak(full, 0.78)} aria-label="Slower"><Snail /></button>
      </div>
      <div className="qword sentence" lang="en" style={{ marginTop: 16 }}>
        {a}<span className={'gap' + (res === null ? '' : res ? ' ok' : ' bad')}>{res === null ? ' ' : v.shown[form][0]}</span>{b}
      </div>
      <div className="qhint">{help ? <>({v.id}) · {sl}</> : 'Listen and write the missing word.'}</div>
      <input ref={inp} className="field" lang="en" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={res !== null}
        value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (res === null) submit(); else onNext() } }} placeholder="What do you hear?" />
      {res === null ? (
        <div className="s-actions">
          {!help ? <button className="btn sm" onClick={() => setHelp(true)}><Ear />I can't hear it</button> : <button className="btn sm" onClick={() => submit(true)}>I don't know</button>}
          <button className="btn sm primary" onClick={() => submit()}>Check</button>
        </div>
      ) : (
        <>
          <motion.div className={'result ' + (res || over ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{res ? 'Heard correctly' : over ? 'Noted' : 'Not yet'}<Listen text={full} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            {!res && !over && <Why task={text} given={val} correct={v.shown[form][0]} ctx={`Dictation, verb ${v.id}, ${form}`} />}
            {!res && !over && val.trim() && <button className="btn ghost sm" onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 0 }) }}>I was right</button>}
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────── match pairs: infinitive with its form ───────── */
export function MatchQ({ entry, onAnswer, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as VItem
  const v = item.verb
  const form = useMemo<'past' | 'pp'>(() => (Math.random() < 0.5 ? 'past' : 'pp'), [])
  const pairs = useMemo(() => {
    const items = getState().items
    const used = new Set([v.shown[form][0], v.shown.inf[0]])
    const pick: Verb[] = [v]
    const known = shuffle(VERBS.filter((x) => x.id !== v.id && items['v:' + x.id]?.reps))
    const pool = [...known, ...shuffle(VERBS.filter((x) => x.id !== v.id && Math.abs(x.tier - v.tier) <= 1))]
    for (const x of pool) {
      if (pick.length >= 4) break
      const f = x.shown[form][0]
      if (used.has(f) || used.has(x.shown.inf[0]) || pick.includes(x)) continue
      used.add(f); used.add(x.shown.inf[0]); pick.push(x)
    }
    return pick
  }, [v, form])
  const left = useMemo(() => shuffle(pairs.map((p) => p.id)), [pairs])
  const right = useMemo(() => shuffle(pairs.map((p) => p.id)), [pairs])
  const [sel, setSel] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [shake, setShake] = useState<string | null>(null)
  const miss = useRef(0)
  const missMain = useRef(false)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  const finished = done.length === pairs.length
  useEffect(() => { pairs.forEach((p) => prefetchVerb(p.id)) }, [pairs])
  const tapRight = (id: string) => {
    if (!sel || done.includes(id)) return
    if (sel === id) {
      const nd = [...done, id]
      setDone(nd); setSel(null)
      if (speechOn()) speakVerb(id, id)
      if (nd.length === pairs.length) {
        const ok = !missMain.current && miss.current <= 1
        const secs = (Date.now() - t0.current) / 1000
        onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 2.4, miss.current ? 1 : 0), errFields: missMain.current ? [form] : [], secs })
        setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
      }
    } else {
      miss.current++
      if (sel === v.id || id === v.id) missMain.current = true
      setShake(id); setTimeout(() => setShake(null), 380)
      setSel(null)
    }
  }
  const V = (id: string) => pairs.find((p) => p.id === id)!
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Match the pairs</span></div>
      <div className="qword long" style={{ marginTop: 14 }}>Match the infinitive with its form <b>{form === 'pp' ? 'past participle' : 'past simple'}</b>.</div>
      <div className="match-grid" lang="en">
        <div className="match-col">
          {left.map((id) => (
            <button key={id} className={'tile big' + (done.includes(id) ? ' done' : sel === id ? ' sel' : '')} disabled={done.includes(id)} onClick={() => setSel(id)}>{V(id).shown.inf[0]}</button>
          ))}
        </div>
        <div className="match-col">
          {right.map((id) => (
            <motion.button key={id} className={'tile big' + (done.includes(id) ? ' done' : '')} disabled={done.includes(id)} onClick={() => tapRight(id)}
              animate={shake === id ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>{V(id).shown[form][0]}</motion.button>
          ))}
        </div>
      </div>
      {finished && (
        <>
          <motion.div className={'result ' + (!missMain.current && miss.current <= 1 ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{miss.current === 0 ? <>No mistakes <Check size={18} /></> : `Mistakes: ${miss.current}`}</h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}
