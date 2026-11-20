// Križanka: mreža kot v aplikacijah za križanke. Namigi so slike (ilustracije besed z listov) ali besedilo z učnih listov.
// Tipkaš s tipkovnico v aplikaciji (ali s pravo tipkovnico), izbrana beseda je obarvana, z dotikom iste celice zamenjaš smer.
// Ob koncu se vsaka beseda s sliko zapiše v svoj spomin (FSRS) in v model šibkih točk, kot pri ostalih nalogah.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Lightbulb, CheckCheck, Eye, Delete, RotateCcw, Grid3x3, Check } from 'lucide-react'
import { buildCrossword, crosswordPool, type XGrid, type XWord } from '../lib/crossword'
import { getState, putItem, updateProfile } from '../lib/store'
import { emptyState, review, type Grade } from '../lib/fsrs'
import { DECK_BY_ID, cardB, today, dayOffset, type QItem } from '../lib/content'
import { recordAnswer } from '../lib/weak'
import { updateAbility } from '../lib/adaptive'
import { scheduleLeaguePush } from '../lib/league'
import { speak, prepare, haptic } from '../lib/speech'
import { sfx } from '../lib/sound'
import { PIC_BY_ID } from '../data/pictures'
import { PicImg } from './Pics'

const key = (r: number, c: number) => r + ',' + c
const cellsOf = (w: XWord) => Array.from({ length: w.answer.length }, (_, i) => key(w.row + (w.dir === 'd' ? i : 0), w.col + (w.dir === 'a' ? i : 0)))
const lens = (w: XWord) => w.shown.split(/[ -]/).map((p) => p.replace(/[^a-z]/gi, '').length).join(', ')
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

interface Res { w: XWord; ok: boolean; grade: Grade }

/** Zapiše rezultat ene besede (spomin, šibke točke, XP, niz dni), enako kot odgovor v seji. */
function record(results: Res[], secs: number) {
  const st = getState()
  const now = Date.now()
  const deck = DECK_BY_ID['vocab']
  let xp = 0, n = 0, c = 0
  let theta = st.profile.theta, thetaN = st.profile.thetaN
  for (const r of results) {
    n++; if (r.ok) c++
    xp += r.ok ? (r.grade >= 3 ? 7 : 4) : 1
    if (!r.w.key) continue
    const prev = st.items[r.w.key] || emptyState()
    const next = { ...review({ ...prev, seen: prev.seen + 1, correct: prev.correct + (r.ok ? 1 : 0), hist: [...(prev.hist || []), r.ok ? 1 : 0].slice(-12) }, r.grade, now, st.settings.retention) }
    next.run = r.ok ? (prev.reps ? (prev.run || 0) + 1 : 2) : 0
    putItem(r.w.key, next)
    const card = deck?.cards.find((x) => 'c:vocab/' + x.id === r.w.key)
    if (card && deck) {
      const item: QItem = { kind: 'card', key: r.w.key, deck, card }
      recordAnswer(item, r.ok)
      const b = cardB(card)
      if (b != null) { const u = updateAbility(theta, b, r.ok, thetaN); theta = Math.max(-3, Math.min(4, theta + (u.theta - theta) * 0.5)) }
    }
  }
  if (results.length && results.every((r) => r.ok && r.grade >= 3)) xp += 15
  const td = today()
  updateProfile((p) => {
    const np = { ...p, days: { ...p.days } }
    if (np.lastDay !== td) { np.streak = np.lastDay === dayOffset(-1) ? (np.streak || 0) + 1 : 1; np.lastDay = td; np.best = Math.max(np.best || 0, np.streak) }
    const d = { ...(np.days[td] || { n: 0, c: 0, t: 0 }) }
    d.n += n; d.c += c; d.t += Math.min(secs, 900); d.x = (d.x || 0) + xp
    np.days[td] = d
    np.total = (np.total || 0) + n; np.correct = (np.correct || 0) + c; np.time = (np.time || 0) + Math.min(secs, 900)
    np.theta = theta
    np.xwBest = Math.max(np.xwBest || 0, c)
    return np
  })
  scheduleLeaguePush()
  return xp
}

export function Crossword({ onClose }: { onClose: () => void }) {
  const [seed, setSeed] = useState(0)
  const grid: XGrid = useMemo(() => buildCrossword(crosswordPool(getState().items), 8), [seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const cellMap = useMemo(() => {
    const m = new Map<string, { ch: string; a?: number; d?: number; num?: number }>()
    grid.words.forEach((w, i) => cellsOf(w).forEach((k, j) => {
      const cur = m.get(k) || { ch: w.answer[j] }
      if (w.dir === 'a') cur.a = i; else cur.d = i
      if (j === 0) cur.num = w.num
      m.set(k, cur)
    }))
    return m
  }, [grid])
  const [fill, setFill] = useState<Record<string, string>>({})
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [hinted, setHinted] = useState<Set<number>>(new Set())
  const [missed, setMissed] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [wi, setWi] = useState(0)
  const [pos, setPos] = useState(0)
  const [done, setDone] = useState<null | { res: Res[]; xp: number }>(null)
  const t0 = useRef(Date.now())
  const solvedSpoken = useRef<Set<number>>(new Set())

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => {
    setFill({}); setWrong(new Set()); setShown(new Set()); setHinted(new Set()); setMissed(new Set()); setRevealed(new Set()); setWi(0); setPos(0); setDone(null)
    t0.current = Date.now(); solvedSpoken.current = new Set()
    if (getState().settings.speech) grid.words.forEach((w) => void prepare(w.shown))
  }, [grid])

  const w = grid.words[wi]
  const wCells = useMemo(() => (w ? cellsOf(w) : []), [w])
  const cur = wCells[pos]
  const solved = useCallback((i: number, f = fill) => cellsOf(grid.words[i]).every((k, j) => f[k] === grid.words[i].answer[j]), [grid, fill])

  const finish = useCallback((f: Record<string, string>, rev: Set<number>) => {
    const res: Res[] = grid.words.map((x, i) => {
      const ok = !rev.has(i) && cellsOf(x).every((k, j) => f[k] === x.answer[j])
      const grade: Grade = !ok ? 1 : hinted.has(i) || missed.has(i) ? 2 : 3
      return { w: x, ok, grade }
    })
    const xp = record(res, (Date.now() - t0.current) / 1000)
    sfx.finish()
    setDone({ res, xp })
  }, [grid, hinted, missed])

  const select = (k: string) => {
    const info = cellMap.get(k)
    if (!info) return
    const same = k === cur
    let dir: 'a' | 'd' = w?.dir || 'a'
    if (same) dir = dir === 'a' ? 'd' : 'a'
    let idx = dir === 'a' ? info.a : info.d
    if (idx == null) idx = (dir === 'a' ? info.d : info.a)!
    setWi(idx)
    setPos(cellsOf(grid.words[idx]).indexOf(k))
  }
  const goWord = (d: number) => { const n = (wi + d + grid.words.length) % grid.words.length; setWi(n); const cs = cellsOf(grid.words[n]); const e = cs.findIndex((k) => !fill[k]); setPos(e < 0 ? 0 : e) }

  const typeLetter = (ch: string) => {
    if (done || !cur) return
    const f = { ...fill, [cur]: ch }
    setFill(f)
    if (wrong.has(cur)) { const s = new Set(wrong); s.delete(cur); setWrong(s) }
    sfx.key()
    // beseda rešena: izgovori jo
    grid.words.forEach((x, i) => {
      if (!solvedSpoken.current.has(i) && cellsOf(x).every((k, j) => f[k] === x.answer[j])) {
        solvedSpoken.current.add(i)
        sfx.ok(1)
        if (getState().settings.speech) speak(x.shown)
      }
    })
    if (grid.words.every((x) => cellsOf(x).every((k, j) => f[k] === x.answer[j]))) { setTimeout(() => finish(f, revealed), 500); return }
    // naprej: naslednja prazna celica v besedi, sicer naslednja nerešena beseda
    const nextEmpty = wCells.findIndex((k, j) => j > pos && !f[k])
    if (nextEmpty >= 0) setPos(nextEmpty)
    else if (pos < wCells.length - 1) setPos(pos + 1)
    else {
      for (let d = 1; d <= grid.words.length; d++) {
        const n = (wi + d) % grid.words.length
        const cs = cellsOf(grid.words[n])
        const e = cs.findIndex((k) => !f[k])
        if (e >= 0) { setWi(n); setPos(e); break }
      }
    }
  }
  const back = () => {
    if (done || !cur) return
    if (fill[cur] && !shown.has(cur)) { const f = { ...fill }; delete f[cur]; setFill(f); return }
    if (pos > 0) { const p = wCells[pos - 1]; setPos(pos - 1); if (!shown.has(p)) { const f = { ...fill }; delete f[p]; setFill(f) } }
  }
  const hint = () => {
    if (!cur || done) return
    const target = fill[cur] === cellMap.get(cur)!.ch ? wCells.find((k) => fill[k] !== cellMap.get(k)!.ch) : cur
    if (!target) return
    setShown(new Set(shown).add(target))
    setHinted(new Set(hinted).add(wi))
    typeLetterAt(target)
  }
  const typeLetterAt = (k: string) => {
    const f = { ...fill, [k]: cellMap.get(k)!.ch }
    setFill(f)
    if (grid.words.every((x) => cellsOf(x).every((kk, j) => f[kk] === x.answer[j]))) setTimeout(() => finish(f, revealed), 500)
  }
  const check = () => {
    const bad = new Set<string>()
    const miss = new Set(missed)
    grid.words.forEach((x, i) => cellsOf(x).forEach((k, j) => { if (fill[k] && fill[k] !== x.answer[j]) { bad.add(k); miss.add(i) } }))
    setWrong(bad); setMissed(miss)
    haptic(bad.size ? 'bad' : 'ok')
    if (bad.size) sfx.bad()
  }
  const giveUp = () => {
    const f: Record<string, string> = { ...fill }
    const rev = new Set(revealed)
    grid.words.forEach((x, i) => { if (!solved(i)) rev.add(i); cellsOf(x).forEach((k, j) => (f[k] = x.answer[j])) })
    setFill(f); setRevealed(rev)
    setTimeout(() => finish(f, rev), 700)
  }

  // prava tipkovnica (računalnik)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done) return
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); typeLetter(e.key.toUpperCase()) }
      else if (e.key === 'Backspace') { e.preventDefault(); back() }
      else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); goWord(e.shiftKey ? -1 : 1) }
      else if (e.key.startsWith('Arrow') && w) {
        e.preventDefault()
        const [dr, dc] = e.key === 'ArrowUp' ? [-1, 0] : e.key === 'ArrowDown' ? [1, 0] : e.key === 'ArrowLeft' ? [0, -1] : [0, 1]
        const [r, c] = cur.split(',').map(Number)
        const nk = key(r + dr, c + dc)
        if (cellMap.has(nk)) {
          const info = cellMap.get(nk)!
          const want = dr ? 'd' : 'a'
          const idx = (want === 'a' ? info.a : info.d) ?? (want === 'a' ? info.d : info.a)!
          setWi(idx); setPos(cellsOf(grid.words[idx]).indexOf(nk))
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const size = Math.floor(Math.min(36, (Math.min(window.innerWidth, 560) - 36) / grid.cols))
  const inWord = new Set(wCells)
  const across = grid.words.map((x, i) => ({ x, i })).filter(({ x }) => x.dir === 'a')
  const down = grid.words.map((x, i) => ({ x, i })).filter(({ x }) => x.dir === 'd')
  const solvedN = grid.words.filter((_, i) => solved(i)).length

  const ClueBody = ({ x, big }: { x: XWord; big?: boolean }) => 'pic' in x.clue
    ? <PicImg id={x.clue.pic} size={big ? 64 : 44} className="xw-pic" />
    : <span className="xw-txt" lang="en">{x.clue.text}</span>

  return (
    <motion.div className="session xw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="s-inner">
        <div className="s-top">
          <button className="iconbtn" onClick={onClose} aria-label="Zapri"><X /></button>
          <div className="track"><i style={{ width: `${(solvedN / grid.words.length) * 100}%` }} /></div>
          <div className="combo">{solvedN}/{grid.words.length}</div>
        </div>

        {!done ? (
          <>
            {w && (
              <div className="xw-bar">
                <button className="iconbtn" onClick={() => goWord(-1)} aria-label="Prejšnja beseda"><ChevronLeft /></button>
                <AnimatePresence mode="wait">
                  <motion.div key={wi} className="xw-clue" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <ClueBody x={w} big />
                    <span className="xw-meta"><b>{w.num} {w.dir === 'a' ? 'vodoravno' : 'navpično'}</b><span>{'pic' in w.clue ? 'Kaj je na sliki? ' : ''}({lens(w)})</span></span>
                  </motion.div>
                </AnimatePresence>
                <button className="iconbtn" onClick={() => goWord(1)} aria-label="Naslednja beseda"><ChevronRight /></button>
              </div>
            )}

            <div className="xw-grid" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${size}px)`, gridTemplateRows: `repeat(${grid.rows}, ${size}px)` }} role="grid" aria-label="Križanka">
              {Array.from({ length: grid.rows * grid.cols }, (_, i) => {
                const r = Math.floor(i / grid.cols), c = i % grid.cols, k = key(r, c)
                const info = cellMap.get(k)
                if (!info) return <div key={k} className="xw-x" />
                const solvedCell = (info.a != null && solved(info.a)) || (info.d != null && solved(info.d))
                const cls = 'xw-c' + (inWord.has(k) ? ' on' : '') + (k === cur ? ' cur' : '') + (wrong.has(k) ? ' bad' : '') + (shown.has(k) ? ' shown' : '') + (solvedCell ? ' ok' : '')
                return (
                  <button key={k} className={cls} style={{ fontSize: size * 0.52 }} onClick={() => select(k)} aria-label={`Celica ${r + 1}, ${c + 1}`}>
                    {info.num && <i>{info.num}</i>}
                    {fill[k] && <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.16 }}>{fill[k]}</motion.span>}
                  </button>
                )
              })}
            </div>

            <div className="xw-lists">
              {[['Vodoravno', across], ['Navpično', down] as const].map(([title, list]) => (
                <div key={title as string}>
                  <div className="xw-h">{title as string}</div>
                  {(list as { x: XWord; i: number }[]).map(({ x, i }) => (
                    <button key={i} className={'xw-li' + (i === wi ? ' on' : '') + (solved(i) ? ' ok' : '')} onClick={() => { setWi(i); const cs = cellsOf(x); const e = cs.findIndex((k) => !fill[k]); setPos(e < 0 ? 0 : e) }}>
                      <b className="num">{x.num}</b><ClueBody x={x} /><span className="xw-len">{solved(i) ? <Check /> : `(${lens(x)})`}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="xw-dock">
              <div className="xw-tools">
                <button className="btn sm" onClick={hint}><Lightbulb />Črka</button>
                <button className="btn sm" onClick={check}><CheckCheck />Preveri</button>
                <button className="btn sm" onClick={giveUp}><Eye />Rešitev</button>
              </div>
              <div className="kb" role="group" aria-label="Tipkovnica">
                {ROWS.map((row, ri) => (
                  <div className="kb-row" key={ri}>
                    {row.split('').map((ch) => <button key={ch} className="kb-k" onClick={() => typeLetter(ch)}>{ch}</button>)}
                    {ri === 2 && <button className="kb-k wide" onClick={back} aria-label="Briši"><Delete /></button>}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <motion.div className="qcard glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <div className="qmeta"><span className="k place">Križanka rešena</span><span>+{done.xp} XP</span></div>
            <div className="big num">{done.res.filter((r) => r.ok).length}<small> / {done.res.length} besed</small></div>
            <div className="list glass xw-sum">
              {done.res.map((r, i) => (
                <div className="li" key={i}>
                  {'pic' in r.w.clue ? <PicImg id={r.w.clue.pic} size={44} className="xw-pic" /> : <span className="xw-sum-ico"><Grid3x3 /></span>}
                  <div className="li-main">
                    <span className="li-t" lang="en">{r.w.shown}{'pic' in r.w.clue ? <em> · {PIC_BY_ID[r.w.clue.pic].slo}</em> : null}</span>
                    <span className="li-s">{r.ok ? (r.grade >= 3 ? 'brez pomoči' : 's pomočjo') : 'razkrito'}{'text' in r.w.clue ? ` · ${r.w.clue.text}` : ''}</span>
                  </div>
                  <span className={'xw-mark ' + (r.ok ? 'ok' : 'bad')}>{r.ok ? <Check /> : <X />}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={onClose}>Končaj</button>
              <button className="btn primary" onClick={() => setSeed((s) => s + 1)}><RotateCcw />Nova</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
