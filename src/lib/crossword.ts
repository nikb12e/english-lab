// Crossword generator: builds the most compact grid possible from a list of words, where the words cross like in a real crossword
// (no word touches another from the side, every new word crosses the grid at least once).
import { PICS } from '../data/pictures'
import { TEXT_CLUES } from '../data/picBank'
import type { MemState } from './fsrs'
import { retrievability } from './fsrs'

export type Dir = 'a' | 'd'
export interface XCand { answer: string; shown: string; clue: { pic: string } | { text: string }; src: string; key?: string }
export interface XWord extends XCand { row: number; col: number; dir: Dir; num: number }
export interface XGrid { rows: number; cols: number; words: XWord[] }

const letters = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, '')

/** All words that can appear in the crossword: pictures (the clue is a picture) and text clues from the sheets. */
export function candidates(): XCand[] {
  const out: XCand[] = []
  for (const p of PICS) {
    const a = letters(p.en[0])
    if (a.length >= 3 && a.length <= 12) out.push({ answer: a, shown: p.en[0], clue: { pic: p.id }, src: p.src, key: 'c:vocab/pic_' + p.id })
  }
  for (const c of TEXT_CLUES) {
    const a = letters(c.a)
    if (a.length >= 3 && a.length <= 12 && !out.some((o) => o.answer === a)) out.push({ answer: a, shown: c.a, clue: { text: c.clue }, src: c.src })
  }
  return out
}

type Cell = Map<string, string>
const k = (r: number, c: number) => r + ',' + c

function canPlace(grid: Cell, w: string, r: number, c: number, dir: Dir): number {
  const dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0
  if (grid.has(k(r - dr, c - dc)) || grid.has(k(r + dr * w.length, c + dc * w.length))) return -1
  let cross = 0
  for (let i = 0; i < w.length; i++) {
    const rr = r + dr * i, cc = c + dc * i
    const cur = grid.get(k(rr, cc))
    if (cur) { if (cur !== w[i]) return -1; cross++; continue }
    // new cell: neighbours perpendicular to the direction must be empty
    if (grid.has(k(rr + dc, cc + dr)) || grid.has(k(rr - dc, cc - dr))) return -1
  }
  return cross === w.length ? -1 : cross
}

function bbox(grid: Cell) {
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity
  for (const key of grid.keys()) { const [r, c] = key.split(',').map(Number); r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c) }
  return { r0, r1, c0, c1 }
}

function attempt(list: XCand[], target: number, maxW: number, maxH: number, rnd: () => number) {
  const grid: Cell = new Map()
  const placed: (XCand & { row: number; col: number; dir: Dir })[] = []
  const first = list[0]
  for (let i = 0; i < first.answer.length; i++) grid.set(k(0, i), first.answer[i])
  placed.push({ ...first, row: 0, col: 0, dir: 'a' })
  for (const w of list.slice(1)) {
    if (placed.length >= target) break
    let best: { r: number; c: number; dir: Dir; score: number } | null = null
    for (const [key, ch] of grid) {
      const [gr, gc] = key.split(',').map(Number)
      for (let i = 0; i < w.answer.length; i++) {
        if (w.answer[i] !== ch) continue
        for (const dir of ['a', 'd'] as Dir[]) {
          const r = dir === 'd' ? gr - i : gr, c = dir === 'a' ? gc - i : gc
          const cross = canPlace(grid, w.answer, r, c, dir)
          if (cross < 1) continue
          const b = bbox(grid)
          const nr0 = Math.min(b.r0, r), nc0 = Math.min(b.c0, c)
          const nr1 = Math.max(b.r1, dir === 'd' ? r + w.answer.length - 1 : r), nc1 = Math.max(b.c1, dir === 'a' ? c + w.answer.length - 1 : c)
          const h = nr1 - nr0 + 1, wd = nc1 - nc0 + 1
          if (h > maxH || wd > maxW) continue
          const score = cross * 12 - h * wd * 0.15 - Math.abs(h - wd) * 0.6 + rnd()
          if (!best || score > best.score) best = { r, c, dir, score }
        }
      }
    }
    if (!best) continue
    const dr = best.dir === 'd' ? 1 : 0, dc = best.dir === 'a' ? 1 : 0
    for (let i = 0; i < w.answer.length; i++) grid.set(k(best.r + dr * i, best.c + dc * i), w.answer[i])
    placed.push({ ...w, row: best.r, col: best.c, dir: best.dir })
  }
  return { grid, placed }
}

/** Builds the crossword. `pool` is already sorted by priority (words you need to master first). */
export function buildCrossword(pool: XCand[], target = 8, maxW = 11, maxH = 12): XGrid {
  let seed = (Date.now() % 100000) + 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let best: ReturnType<typeof attempt> | null = null
  for (let t = 0; t < 70; t++) {
    // starting words take priority, but the order is shuffled slightly so every crossword is different
    const list = pool.map((w, i) => ({ w, s: i + rnd() * 6 })).sort((a, b) => a.s - b.s).map((x) => x.w)
    const first = list.findIndex((w) => w.answer.length >= 6 && w.answer.length <= maxW)
    if (first > 0) list.unshift(list.splice(first, 1)[0])
    const r = attempt(list, target, maxW, maxH, rnd)
    const b = bbox(r.grid)
    const score = (x: typeof r) => { const bb = bbox(x.grid); return x.placed.length * 100 - (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1) * 0.5 }
    if (!best || score(r) > score(best)) best = r
    if (r.placed.length >= target && (b.r1 - b.r0) <= maxH - 2) break
  }
  const { grid, placed } = best!
  const b = bbox(grid)
  const words = placed.map((w) => ({ ...w, row: w.row - b.r0, col: w.col - b.c0, num: 0 }))
  // numbering in reading order
  const starts = [...new Set(words.map((w) => w.row * 100 + w.col))].sort((a, b) => a - b)
  for (const w of words) w.num = starts.indexOf(w.row * 100 + w.col) + 1
  words.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'a' ? -1 : 1))
  return { rows: b.r1 - b.r0 + 1, cols: b.c1 - b.c0 + 1, words }
}

/** Words for today's crossword: first pictures you forget or do not know yet, then mixed with clues from the sheets. */
export function crosswordPool(items: Record<string, MemState>): XCand[] {
  const now = Date.now()
  const all = candidates()
  const pics = all.filter((c) => c.key).map((c) => {
    const st = items[c.key!]
    const w = !st?.reps ? 0.9 + Math.random() * 0.6 : (1 - retrievability(st, now)) * 1.6 + (st.lapses || 0) * 0.4 + Math.random() * 0.5
    return { c, w }
  }).sort((a, b) => b.w - a.w).map((x) => x.c)
  const texts = all.filter((c) => !c.key).sort(() => Math.random() - 0.5)
  // mix: about two picture clues for each text clue
  const out: XCand[] = []
  let i = 0, j = 0
  while (i < pics.length || j < texts.length) {
    if (i < pics.length) out.push(pics[i++])
    if (i < pics.length) out.push(pics[i++])
    if (j < texts.length) out.push(texts[j++])
  }
  return out
}
