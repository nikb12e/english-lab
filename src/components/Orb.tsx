import { useEffect, useRef, useState, type ReactNode } from 'react'
import { VERBS } from '../lib/verbs'
import { maturity, retrievability, type MemState, type Maturity } from '../lib/fsrs'
import { PRIOR } from '../lib/adaptive'

// Krogla spomina: vsak od 178 glagolov je točka na sferi. Barva = stanje, svetlost = verjetnost priklica.
// Vleka s prstom jo zavrti 1:1, ob spustu ohrani hitrost in se umiri (inercija), nato se spet počasi vrti sama.

const DARK = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
// En odtenek (systemBlue) v štirih jakostih: nov je siv, nato vedno bolj nasičena modra.
const COLORS: Record<Maturity, [number, number, number]> = DARK
  ? { new: [72, 72, 74], learn: [48, 84, 130], young: [28, 110, 210], mature: [10, 132, 255] }
  : { new: [199, 199, 204], learn: [160, 202, 255], young: [80, 160, 255], mature: [0, 122, 255] }

interface P { id: string; x: number; y: number; z: number; m: Maturity; r: number; due: boolean }

function sprite(rgb: [number, number, number]) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  void grd
  g.fillStyle = `rgb(${rgb})`
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill()
  return c
}

export function Orb({ items, onSelect, children }: { items: Record<string, MemState>; onSelect: (id: string) => void; children?: ReactNode }) {
  const sel = useRef(onSelect)
  sel.current = onSelect
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pts = useRef<P[]>([])
  const [tip, setTip] = useState<{ x: number; y: number; id: string } | null>(null)

  // točke: Fibonaccijeva sfera; težji glagoli bližje južnemu polu
  useEffect(() => {
    const sorted = VERBS.slice().sort((a, b) => PRIOR[a.id] - PRIOR[b.id])
    const n = sorted.length
    const now = Date.now()
    const golden = Math.PI * (3 - Math.sqrt(5))
    pts.current = sorted.map((v, i) => {
      const y = 1 - (i / (n - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = golden * i
      const c = items['v:' + v.id]
      return { id: v.id, x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, m: maturity(c), r: retrievability(c, now), due: !!c?.reps && c.due <= now }
    })
  }, [items])

  useEffect(() => {
    const cv = canvas.current!
    const ctx = cv.getContext('2d')!
    const sprites = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, sprite(v)])) as Record<Maturity, HTMLCanvasElement>
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, dpr = 1
    const resize = () => {
      const r = cv.getBoundingClientRect()
      dpr = Math.min(2.5, window.devicePixelRatio || 1)
      W = r.width; H = r.height
      cv.width = W * dpr; cv.height = H * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)

    let rx = -0.35, ry = 0, vx = 0, vy = reduce ? 0 : 0.0032
    const auto = reduce ? 0 : 0.0032
    let drag: null | { x: number; y: number; t: number; moved: number; hist: { x: number; y: number; t: number }[] } = null
    const born = performance.now()
    let raf = 0
    const proj: { id: string; sx: number; sy: number; z: number }[] = []

    const frame = (t: number) => {
      const age = Math.min(1, (t - born) / 1400)
      const grow = 1 - Math.pow(1 - age, 4) // ease-out
      if (!drag) {
        ry += vy; rx += vx
        vy += (auto - vy) * 0.02 // inercija se umiri nazaj v počasno vrtenje
        vx *= 0.94
        rx += (-0.35 - rx) * 0.01
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const R = Math.min(W, H) * 0.4 * (0.6 + 0.4 * grow)
      const cx = W / 2, cy = H / 2
      const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx)
      proj.length = 0
      const list = pts.current.map((p) => {
        const x1 = p.x * cyR + p.z * syR
        const z1 = -p.x * syR + p.z * cyR
        const y2 = p.y * cxR - z1 * sxR
        const z2 = p.y * sxR + z1 * cxR
        const persp = 2.6 / (2.6 + z2)
        return { p, sx: cx + x1 * R * persp, sy: cy + y2 * R * persp, z: z2, s: persp }
      })
      list.sort((a, b) => b.z - a.z)
      // povezave med sosedi: tanka mreža spomina
      ctx.lineWidth = 0.6
      for (let i = 0; i < list.length; i++) {
        const a = list[i]
        if (a.z > 0.2) continue
        for (let j = i + 1; j < Math.min(list.length, i + 6); j++) {
          const b = list[j]
          const dx = a.sx - b.sx, dy = a.sy - b.sy
          const d2 = dx * dx + dy * dy
          if (d2 < (R * 0.24) ** 2) {
            ctx.strokeStyle = `rgba(120,120,128,${0.1 * (1 - (a.z + 1) / 2.2) * grow})`
            ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
          }
        }
      }
      for (const { p, sx, sy, z, s } of list) {
        const front = (1 - z) / 2 // 0 zadaj, 1 spredaj
        const known = p.m !== 'new'
        const pulse = 1; void t
        const size = (known ? 6 + 4 * p.r : 4.4) * s * (0.6 + 0.55 * front) * grow
        ctx.globalAlpha = (0.35 + 0.65 * front) * pulse
        ctx.drawImage(sprites[p.m], sx - size / 2, sy - size / 2, size, size)
        if (p.due && front > 0.4) {
          ctx.globalAlpha = 0.6 * front
          ctx.strokeStyle = DARK ? 'rgba(255,69,58,1)' : 'rgba(255,59,48,1)'
          ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.arc(sx, sy, size * 1.25, 0, Math.PI * 2); ctx.stroke()
        }
        proj.push({ id: p.id, sx, sy, z })
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const pt = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const down = (e: PointerEvent) => {
      const p = pt(e)
      drag = { ...p, t: performance.now(), moved: 0, hist: [{ ...p, t: performance.now() }] }
      vx = 0; vy = 0
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const p = pt(e)
      const dx = p.x - drag.x, dy = p.y - drag.y
      drag.moved += Math.abs(dx) + Math.abs(dy)
      if (drag.moved > 6) {
        if (Math.abs(dx) > Math.abs(dy) || drag.moved > 30) e.preventDefault()
        try { cv.setPointerCapture(e.pointerId) } catch { /* */ }
      }
      ry += dx * 0.0085
      rx = Math.max(-1.2, Math.min(1.2, rx + dy * 0.0085))
      drag.x = p.x; drag.y = p.y
      drag.hist.push({ ...p, t: performance.now() })
      if (drag.hist.length > 6) drag.hist.shift()
    }
    const up = (e: PointerEvent) => {
      if (!drag) return
      const p = pt(e)
      if (drag.moved < 8) {
        // dotik: najbližja točka spredaj
        let best: { id: string; sx: number; sy: number; d: number } | null = null
        for (const q of proj) {
          if (q.z > 0.15) continue
          const d = Math.hypot(q.sx - p.x, q.sy - p.y)
          if (d < 26 && (!best || d < best.d)) best = { id: q.id, sx: q.sx, sy: q.sy, d }
        }
        if (best) { setTip({ x: best.sx, y: best.sy, id: best.id }); sel.current(best.id) }
      } else {
        // predaja hitrosti: zadnjih nekaj premikov določi zagon
        const h = drag.hist
        const a = h[0], b = h[h.length - 1]
        const dt = Math.max(16, b.t - a.t)
        vy = ((b.x - a.x) / dt) * 16 * 0.0085
        vx = ((b.y - a.y) / dt) * 16 * 0.0085 * 0.6
      }
      drag = null
    }
    cv.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(null), 1800)
    return () => clearTimeout(t)
  }, [tip])

  const v = tip ? VERBS.find((x) => x.id === tip.id) : null
  return (
    <div ref={wrap} className="orb-wrap">
      <canvas ref={canvas} aria-label="Krogla spomina: vsak glagol je ena točka. Povleci za vrtenje, tapni točko za podrobnosti." role="img" />
      {children}
      {tip && v && (
        <div className="orb-tip" style={{ left: tip.x, top: tip.y }}>{v.id} <em>· {v.shown.past.join('/')} · {v.shown.pp.join('/')}</em></div>
      )}
    </div>
  )
}
