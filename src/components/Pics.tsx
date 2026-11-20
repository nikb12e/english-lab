// Name the picture: an illustration of a word from the worksheets. A new or still uncertain word: choose from four (recognition);
// mastered: typing without options (recall). This way the task grows with you, as with other task types.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Lightbulb } from 'lucide-react'
import type { QItem } from '../lib/content'
import type { TypeCard } from '../data/types'
import { PICS, PIC_BY_ID, PIC_CAT, type Pic } from '../data/pictures'
import { checkText, lev, norm } from '../lib/check'
import { getState } from '../lib/store'
import { speak, prepare, haptic } from '../lib/speech'
import { spring, Tag, gradeFor, type Entry, type Result } from './qshared'
import { Listen } from './Tasks'
import { Kinetic } from './Kinetic'

const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/** Illustration (SVG from pictures.ts). */
export function PicImg({ id, size = 200, className = '' }: { id: string; size?: number; className?: string }) {
  const p = PIC_BY_ID[id]
  if (!p) return null
  return <div className={'pic ' + className} style={{ width: size, height: size }} aria-label="Illustration" role="img" dangerouslySetInnerHTML={{ __html: p.svg }} />
}

/** Three convincing wrong options from the same group (clothes with clothes …). */
export function distractors(p: Pic, n = 3): string[] {
  const same = shuffle(PICS.filter((x) => x.cat === p.cat && x.id !== p.id)).map((x) => x.en[0])
  return same.filter((w) => !p.en.includes(w)).slice(0, n)
}

export function PicQ({ entry, card, onAnswer, onOverride, onNext }: { entry: Entry; card: TypeCard; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'card' }>
  const p = PIC_BY_ID[card.img!]
  const st = getState().items[item.key]
  // recognition until the word is mastered (and when repeating a mistake), then recall
  const choose = !st?.reps || (st.S || 0) < 2 || entry.kind === 'retry'
  const options = useMemo(() => shuffle([p.en[0], ...distractors(p)]), [p])
  const [val, setVal] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [res, setRes] = useState<null | boolean>(null)
  const [over, setOver] = useState(false)
  const [hintN, setHintN] = useState(0)
  const t0 = useRef(Date.now())
  const inp = useRef<HTMLInputElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (getState().settings.speech) void prepare(p.en[0]) }, [p])
  useEffect(() => { if (!choose) { const t = setTimeout(() => inp.current?.focus({ preventScroll: true }), 140); return () => clearTimeout(t) } }, [choose])
  useEffect(() => {
    if (!choose || res !== null) return
    const h = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) answerChoice(options[n - 1]) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const finish = (ok: boolean, nFields: number) => {
    setRes(ok)
    haptic(ok ? 'ok' : 'bad')
    if (getState().settings.speech) setTimeout(() => speak(p.en[0]), ok ? 60 : 300)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, nFields, hintN), secs })
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const answerChoice = (w: string) => { if (res !== null) return; setPick(w); finish(p.en.includes(w), 0.8) }
  const submit = (gaveUp = false) => {
    if (res !== null) return
    if (!gaveUp && !val.trim()) return
    finish(!gaveUp && checkText(val, p.en), 1.2)
  }
  const best = p.en.reduce((a, b) => (lev(norm(val), norm(b)) < lev(norm(val), norm(a)) ? b : a))
  const good = !!res || over
  const flat = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '')
  const alts = p.en.slice(1).filter((w) => { const a = flat(w), m = flat(p.en[0]); return a !== m && a + 's' !== m && m + 's' !== a })
  const hintTxt = hintN === 1 ? card.hint : hintN === 2 ? p.en[0].slice(0, Math.ceil(p.en[0].length / 2)) + '…' : ''

  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /></span><span>{PIC_CAT[p.cat].name}</span></div>
      <motion.div className="pic-stage" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <PicImg id={p.id} size={196} />
      </motion.div>
      <div className="pic-q">{choose ? 'What is in the picture?' : 'Write what is in the picture'}</div>

      {choose ? (
        <div className="choices pic-choices">
          {options.map((w, n) => {
            const isRight = p.en.includes(w)
            return (
              <motion.button key={w} lang="en" className={'choice' + (res === null ? '' : isRight ? ' ok' : w === pick ? ' bad' : ' dim')} onClick={() => answerChoice(w)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 + n * 0.04 }}>
                <span className="key">{res !== null && isRight ? <Check size={15} /> : n + 1}</span>{w}
              </motion.button>
            )
          })}
        </div>
      ) : (
        <>
          {res === null && (
            <div className="hintline">
              <button className="btn ghost sm" disabled={hintN >= 2} onClick={() => { setHintN((h) => h + 1); inp.current?.focus() }}><Lightbulb />{hintN === 0 ? 'Hint' : hintN === 1 ? 'Another hint' : 'No more hints'}</button>
              {hintTxt && <motion.span key={hintN} className="hintw" lang="en" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>{hintTxt}</motion.span>}
            </div>
          )}
          <div className="fields">
            <Kinetic ref={inp} value={val} onChange={setVal} onEnter={() => (res === null ? submit() : onNext())} status={res === null ? 'idle' : good ? 'ok' : 'bad'} correct={best} ariaLabel="English word" />
          </div>
        </>
      )}

      <AnimatePresence>
        {res !== null && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            <h3>{good ? 'Correct' : 'Not yet'}<Listen text={p.en[0]} /></h3>
            <p className="pic-ans"><b lang="en">{p.en[0]}</b> in Slovenian: “{p.slo}”</p>
            {alts.length > 0 && <p className="small muted">Also accepted: <span lang="en">{alts.join(', ')}</span></p>}
            <p className="small muted">Source: {p.src}</p>
            {!choose && res === false && !over && val.trim() && lev(norm(val), norm(best)) === 1 && (
              <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 5 }) }}>Typo, count it as correct</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="s-actions">
        {res === null ? (
          choose ? <button className="btn sm" onClick={() => answerChoice('')}>I don't know</button>
            : <><button className="btn sm" onClick={() => submit(true)}>I don't know</button><button className="btn sm primary" onClick={() => submit()}>Check</button></>
        ) : (
          <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Next<ArrowRight /></button>
        )}
      </div>
    </div>
  )
}
