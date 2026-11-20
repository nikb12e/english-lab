// Picture dictionary: every word comes from the English worksheets:
//  Clothes.pdf, Appearance.pdf, Places to visit.pdf, Vocabulary building: travel, holidays (both sheets) and Mock test 1.
//  The illustrations are hand drawn in SVG, in the app's colours, with a consistent stroke width.

export type PicCat = 'clothes' | 'body' | 'gear' | 'travel'
export interface Pic {
  id: string
  /** accepted answers; the first is the main one */
  en: string[]
  slo: string
  cat: PicCat
  /** source worksheet */
  src: string
  svg: string
}

export const PIC_CAT: Record<PicCat, { name: string; bg: string }> = {
  clothes: { name: 'Clothes', bg: '#f1eeff' },
  body: { name: 'Appearance and body', bg: '#fff1ea' },
  gear: { name: 'Holiday gear', bg: '#e6f8f0' },
  travel: { name: 'Travel', bg: '#e8f3ff' },
}

// palette
const I = '#1f2140', V = '#6a4dff', V2 = '#a796ff', V3 = '#ddd5ff', M = '#19c28a', M2 = '#9be8c8', C = '#ff5d5d', C2 = '#ffb5ad'
const A = '#ffb020', A2 = '#ffd98a', S = '#4ea8ff', S2 = '#bfe0ff', SK = '#ffd6b8', SK2 = '#f2b48e', BR = '#7a4a2b', BR2 = '#b9824f'
const G = '#c3c8db', G2 = '#e4e7f1', W = '#ffffff', D = '#3f6fd1', GI = '#ea7a32', DK = '#3a3e63', SAND = '#f6dd9e'

const SRC = {
  clothes: 'Clothes.pdf',
  appear: 'Appearance.pdf',
  equip: 'Places to visit.pdf, task 4 (Equipment)',
  travel1: 'Travel, holidays (list 1)',
  travel2: 'Travel, holidays (list 2)',
  mock: 'Mock test 1',
}

function wrap(cat: PicCat, inner: string, defs = '', shadow = true) {
  return `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" role="img"><defs><clipPath id="k-__ID__"><rect width="128" height="128" rx="30"/></clipPath>${defs}</defs><rect width="128" height="128" rx="30" fill="${PIC_CAT[cat].bg}"/><g clip-path="url(#k-__ID__)">${shadow ? `<ellipse cx="64" cy="114" rx="40" ry="5" fill="${I}" opacity=".08"/>` : ''}<g stroke="${I}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${inner}</g></g></svg>`
}
const thin = (d: string, w = 2) => `<path d="${d}" fill="none" stroke-width="${w}"/>`
const line = (d: string) => `<path d="${d}" fill="none"/>`
const P = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`
const circ = (cx: number, cy: number, r: number, fill: string, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`
const shine = (d: string) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>`
const arrow = (x1: number, y1: number, x2: number, y2: number) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 8
  const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)], p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)]
  return `<g stroke="${V}" stroke-width="3.5"><path d="M${x1} ${y1} L${x2} ${y2}" fill="none"/><path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${x2} ${y2} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none"/></g>`
}
/** tiny dots (stubble, freckles); deterministic */
function dots(cx: number, cy: number, rx: number, ry: number, n: number, fill: string, r = 1.3, seed = 7) {
  let s = seed, out = ''
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < n; i++) {
    const t = rnd() * Math.PI * 2, k = Math.sqrt(rnd())
    out += `<circle cx="${(cx + Math.cos(t) * rx * k).toFixed(1)}" cy="${(cy + Math.sin(t) * ry * k).toFixed(1)}" r="${r}" fill="${fill}" stroke="none"/>`
  }
  return out
}

/* ───────── helper figures ───────── */
const shoulders = (fill = V3) => P('M26 124 Q28 98 64 95 Q100 98 102 124 Z', fill) + P('M55 82 L73 82 L73 98 Q64 103 55 98 Z', SK2)
const ears = (cy = 64) => circ(33, cy, 7, SK) + circ(95, cy, 7, SK)
const eyes = (y = 62) => circ(53, y, 3.2, I, ' stroke="none"') + circ(75, y, 3.2, I, ' stroke="none"')
const smile = (y = 76) => line(`M56 ${y} Q64 ${y + 6} 72 ${y}`)
const nose = (y = 70) => thin(`M64 ${y - 6} Q61 ${y} 65 ${y + 1}`, 2.4)
const head = (fill = SK) => P('M34 62 Q34 30 64 30 Q94 30 94 62 Q94 92 64 92 Q34 92 34 62 Z', fill)
const shortHair = (fill = BR) => P('M33 60 Q30 24 64 22 Q98 24 95 60 Q90 42 78 40 Q64 46 50 40 Q38 42 33 60 Z', fill)

/** top with a picture (for patterns: a sleeveless top as on the sheet) */
const tankTop = (fill: string) => P('M44 24 L52 24 Q54 44 64 46 Q74 44 76 24 L84 24 Q86 50 92 60 L94 108 L34 108 L36 60 Q42 50 44 24 Z', fill) + line('M38 64 Q64 70 90 64')

const mitten = (dx: number, rot: number) => `<g transform="translate(${dx} 0) rotate(${rot} 44 70)">${P('M30 52 Q30 32 46 32 Q60 32 60 52 L60 82 L30 82 Z', C)}${P('M31 60 Q18 56 18 66 Q19 74 31 72', C)}${P('M28 82 L62 82 L62 96 L28 96 Z', W)}${thin('M36 84 L36 94 M42 84 L42 94 M48 84 L48 94 M54 84 L54 94', 2)}${circ(45, 50, 4, W, ' stroke="none"')}${circ(52, 62, 2.5, W, ' stroke="none"')}${circ(39, 64, 2.5, W, ' stroke="none"')}</g>`

const sandal = (dx: number, dy: number, strap: string) => `<g transform="translate(${dx} ${dy})">${P('M14 92 Q14 82 26 82 L104 80 Q118 80 118 90 Q118 98 106 98 L24 100 Q14 100 14 92 Z', BR2)}${thin('M20 89 L112 87', 2)}${P('M64 82 Q78 50 104 81 L95 81 Q80 62 73 82 Z', strap)}${P('M26 82 Q26 54 42 50 Q52 48 56 56 L50 60 Q46 56 42 57 Q35 60 35 82 Z', strap)}<rect x="46" y="52" width="8" height="9" rx="2" fill="${A2}" stroke-width="2"/></g>`
const flipper = (dx: number, rot: number) => `<g transform="translate(${dx} 0) rotate(${rot} 64 64)">${P('M52 22 Q64 16 76 22 L80 52 L96 104 Q64 116 32 104 L48 52 Z', S)}${P('M50 22 Q64 14 78 22 L78 48 Q64 54 50 48 Z', D)}${thin('M56 60 L50 104 M64 60 L64 108 M72 60 L78 104', 2.4)}</g>`

const bed = (x: number, w: number, pillows: number) => {
  let s = P(`M${x} 44 Q${x} 36 ${x + 8} 36 L${x + w - 8} 36 Q${x + w} 36 ${x + w} 44 L${x + w} 70 L${x} 70 Z`, BR2)
  s += P(`M${x - 2} 66 L${x + w + 2} 66 L${x + w + 2} 98 L${x - 2} 98 Z`, W)
  for (let i = 0; i < pillows; i++) { const pw = (w - 12) / pillows, px = x + 6 + i * pw; s += P(`M${px + 2} 56 Q${px + 2} 50 ${px + 8} 50 L${px + pw - 6} 50 Q${px + pw - 2} 50 ${px + pw - 2} 56 L${px + pw - 2} 64 L${px + 2} 64 Z`, W) }
  s += P(`M${x - 2} 76 L${x + w + 2} 76 L${x + w + 2} 98 L${x - 2} 98 Z`, V2) + line(`M${x - 2} 84 L${x + w + 2} 84`)
  s += P(`M${x} 98 L${x + 6} 98 L${x + 6} 108 L${x} 108 Z`, BR2) + P(`M${x + w - 6} 98 L${x + w} 98 L${x + w} 108 L${x + w - 6} 108 Z`, BR2)
  return s
}

const car = (x: number, y: number, fill: string) => `<g transform="translate(${x} ${y})">${P('M2 18 Q2 10 10 10 L14 2 Q16 0 20 0 L34 0 Q38 0 40 4 L44 10 Q50 10 50 18 L50 22 L2 22 Z', fill)}${P('M17 3 L35 3 L39 10 L14 10 Z', S2)}${circ(13, 23, 5, DK)}${circ(39, 23, 5, DK)}</g>`

/* ───────── pictures ───────── */
type Def = [id: string, en: string[], slo: string, cat: PicCat, src: string, svg: string]

const DEFS: Def[] = [
  // ── CLOTHES (Clothes.pdf) ──
  ['coat', ['coat'], 'plašč', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 28 L28 52 L26 94 L37 94 L42 58', V2) + P('M84 28 L100 52 L102 94 L91 94 L86 58', V2) +
    P('M44 26 Q64 34 84 26 L90 108 L38 108 Z', V) + P('M52 23 L44 36 L62 48 Z', V3) + P('M76 23 L84 36 L66 48 Z', V3) +
    line('M64 48 L64 108') + circ(70, 62, 3, W) + circ(70, 76, 3, W) + circ(70, 90, 3, W) + line('M44 84 L56 84') + line('M76 84 L84 84') + shine('M48 44 L46 100'))],
  ['blouse', ['blouse'], 'bluza', 'clothes', SRC.clothes, wrap('clothes',
    P('M46 34 Q30 36 28 58 Q36 64 47 58', C2) + P('M82 34 Q98 36 100 58 Q92 64 81 58', C2) +
    P('M46 32 Q64 40 82 32 L88 100 Q64 106 40 100 Z', C2) + P('M50 30 Q52 46 64 41 Q76 46 78 30 Q64 36 50 30 Z', W) +
    circ(64, 54, 2.6, W) + circ(64, 66, 2.6, W) + circ(64, 78, 2.6, W) + circ(64, 90, 2.6, W) + thin('M36 54 Q38 58 42 56 M86 56 Q90 58 92 54', 2))],
  ['jumper', ['jumper', 'pullover', 'sweater'], 'pulover', 'clothes', SRC.clothes, wrap('clothes',
    P('M42 34 L24 82 L35 88 L47 58', M) + P('M86 34 L104 82 L93 88 L81 58', M) + P('M22 80 L36 86 L33 96 L19 90 Z', M2) + P('M106 80 L92 86 L95 96 L109 90 Z', M2) +
    P('M42 32 L86 32 L88 96 L40 96 Z', M) + P('M40 92 L88 92 L88 104 L40 104 Z', M2) + P('M52 32 Q64 46 76 32 Q64 38 52 32 Z', M2) +
    thin('M48 60 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6', 2.4) + thin('M48 74 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6', 2.4))],
  ['collar', ['collar'], 'ovratnik', 'clothes', SRC.clothes, wrap('clothes',
    P('M16 116 Q22 64 48 54 L80 54 Q106 64 112 116 Z', S2) + line('M64 66 L64 116') + circ(64, 80, 2.8, W) + circ(64, 98, 2.8, W) +
    P('M47 34 Q64 42 81 34 L81 52 Q64 60 47 52 Z', A) + P('M49 48 L34 78 L62 66 Z', A) + P('M79 48 L94 78 L66 66 Z', A) +
    arrow(108, 30, 92, 50))],
  ['mittens', ['mittens', 'mitten'], 'rokavice (prsti skupaj)', 'clothes', SRC.clothes, wrap('clothes', mitten(-8, -10) + mitten(36, 10))],
  ['zip', ['zip', 'zipper'], 'zadrga', 'clothes', SRC.clothes, wrap('clothes',
    P('M30 10 L56 10 L56 118 L30 118 Z', V) + P('M72 10 L98 10 L98 118 L72 118 Z', V) +
    Array.from({ length: 12 }, (_, i) => `<rect x="${i % 2 ? 62 : 54}" y="${14 + i * 8.6}" width="12" height="6" rx="2" fill="${A}" stroke-width="2"/>`).join('') +
    P('M50 36 L78 36 L74 62 L54 62 Z', G) + `<rect x="57" y="58" width="14" height="34" rx="7" fill="${G}"/>` + `<rect x="61" y="74" width="6" height="12" rx="3" fill="${G2}" stroke-width="2"/>`)],
  ['tights', ['tights'], 'žabe', 'clothes', SRC.clothes, wrap('clothes',
    P('M38 18 L90 18 L90 30 L38 30 Z', V2) +
    P('M38 30 L64 30 L64 52 L58 98 Q58 110 48 110 L34 110 Q28 104 40 98 L42 54 Z', C) +
    P('M90 30 L64 30 L64 52 L70 98 Q70 110 80 110 L94 110 Q100 104 88 98 L86 54 Z', C) +
    shine('M46 40 L48 92') + shine('M82 40 L80 92'))],
  ['trousers', ['trousers', 'pants'], 'hlače', 'clothes', SRC.clothes, wrap('clothes',
    P('M40 18 L88 18 L94 112 L70 112 L64 50 L58 112 L34 112 Z', '#7b8fd6') + line('M40 28 L88 28') + line('M64 28 L64 48') +
    circ(64, 23, 2.4, W) + thin('M50 36 L46 108', 2) + thin('M78 36 L82 108', 2) + thin('M44 28 L44 18 M56 28 L56 18 M72 28 L72 18 M84 28 L84 18', 2))],
  ['waistcoat', ['waistcoat', 'vest'], 'brezrokavnik', 'clothes', SRC.clothes, wrap('clothes',
    P('M52 14 L76 14 L72 40 L64 58 L56 40 Z', W) + P('M60 20 L68 20 L66 50 L64 54 L62 50 Z', C) +
    P('M48 16 L58 20 L64 58 L70 20 L80 16 Q84 40 96 46 L94 100 L70 110 L64 100 L58 110 L34 100 L32 46 Q44 40 48 16 Z', BR2) +
    circ(64, 68, 2.8, A2) + circ(64, 80, 2.8, A2) + circ(64, 92, 2.8, A2) + line('M40 74 L52 72') + line('M76 72 L88 74'))],
  ['cardigan', ['cardigan'], 'jopica', 'clothes', SRC.clothes, wrap('clothes',
    P('M42 32 L24 82 L35 88 L47 58', V2) + P('M86 32 L104 82 L93 88 L81 58', V2) +
    P('M42 30 L56 30 L64 64 L72 30 L86 30 L88 100 L40 100 Z', V) + P('M56 30 L72 30 L64 64 Z', W) +
    line('M64 64 L64 100') + line('M40 92 L88 92') + circ(64, 72, 3, W) + circ(64, 84, 3, W) +
    P('M44 70 L56 70 L56 84 L44 84 Z', V2) + P('M72 70 L84 70 L84 84 L72 84 Z', V2))],
  ['dressing-gown', ['dressing gown', 'bathrobe'], 'kopalni plašč', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 24 L24 66 L38 74 L48 48', S2) + P('M84 24 L104 66 L90 74 L80 48', S2) +
    P('M44 22 Q64 28 84 22 L92 112 L36 112 Z', S2) + P('M50 22 Q54 50 74 72 L66 76 Q48 56 46 26 Z', W) + P('M78 22 Q74 44 66 62 L62 58 Q70 42 72 24 Z', W) +
    P('M37 70 L91 70 L91 79 L37 79 Z', S) + P('M60 76 L52 100 L59 101 L64 82 L69 101 L76 100 L68 76 Z', S))],
  ['polo-neck', ['polo neck', 'polo-neck', 'turtleneck', 'poloneck'], 'puli', 'clothes', SRC.clothes, wrap('clothes',
    P('M42 36 L24 84 L35 90 L47 60', C) + P('M86 36 L104 84 L93 90 L81 60', C) +
    P('M42 34 L86 34 L88 100 L40 100 Z', C) + P('M48 14 L80 14 L80 38 Q64 42 48 38 Z', C2) +
    thin('M54 16 L54 38 M60 16 L60 40 M66 16 L66 40 M72 16 L72 40 M77 16 L77 38', 2) + line('M40 92 L88 92'))],
  ['polo-shirt', ['polo shirt', 'polo'], 'majica s kratkimi rokavi in ovratnikom (polo)', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 30 L24 48 L34 64 L46 54', M) + P('M84 30 L104 48 L94 64 L82 54', M) +
    P('M44 28 L84 28 L86 104 L42 104 Z', M) + P('M58 36 L70 36 L70 60 L58 60 Z', M2) + circ(64, 44, 2.4, W) + circ(64, 53, 2.4, W) +
    P('M50 26 L64 38 L78 26 L82 18 L64 30 L46 18 Z', W))],
  ['tracksuit', ['tracksuit', 'track suit'], 'trenirka', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 66 L84 66 L88 116 L68 116 L64 84 L60 116 L40 116 Z', V) + thin('M46 70 L42 114', 3) .replace('fill="none"', `fill="none" stroke="${W}"`) + `<path d="M82 70 L86 114" fill="none" stroke="${W}" stroke-width="3"/>` +
    P('M44 18 L28 54 L37 60 L47 38', V) + P('M84 18 L100 54 L91 60 L81 38', V) + `<path d="M40 24 L30 52 M88 24 L98 52" fill="none" stroke="${W}" stroke-width="3"/>` +
    P('M44 16 L84 16 L86 66 L42 66 Z', V) + P('M54 10 L74 10 L74 18 L54 18 Z', V2) + line('M64 18 L64 66') + circ(64, 26, 2.6, G))],
  ['sweatpants', ['sweatpants', 'sweat pants', 'tracksuit bottoms', 'joggers'], 'spodnji del trenirke', 'clothes', SRC.clothes, wrap('clothes',
    P('M40 20 L88 20 L92 100 L70 100 L64 52 L58 100 L36 100 Z', G) + P('M40 20 L88 20 L88 32 L40 32 Z', G2) +
    thin('M60 32 Q58 42 55 48 M68 32 Q70 42 73 48', 2.4) + P('M35 98 L59 98 L59 110 L35 110 Z', G2) + P('M69 98 L93 98 L93 110 L69 110 Z', G2) + line('M44 40 Q48 60 46 90'))],
  ['sweat-jacket', ['sweat jacket', 'tracksuit top', 'track jacket', 'tracksuit jacket', 'hoodie'], 'zgornji del trenirke', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 30 L26 82 L37 88 L48 58', A) + P('M84 30 L102 82 L91 88 L80 58', A) +
    P('M46 30 Q46 8 64 8 Q82 8 82 30 Z', A2) + P('M42 28 L86 28 L88 100 L40 100 Z', A) + line('M64 30 L64 100') +
    P('M46 70 L82 70 L86 92 L42 92 Z', A2) + line('M64 70 L64 92') + thin('M56 30 L54 48 M72 30 L74 48', 2.4) + circ(54, 50, 2, W) + circ(74, 50, 2, W))],
  // patterns (task 2 on the Clothes sheet)
  ['plain', ['plain'], 'enobarven', 'clothes', SRC.clothes, wrap('clothes', tankTop(V) + shine('M44 72 L42 100'))],
  ['striped', ['striped', 'stripy'], 'črtast', 'clothes', SRC.clothes, wrap('clothes', tankTop('url(#p-stripe)'),
    `<pattern id="p-stripe" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${W}"/><rect width="5" height="10" fill="${V}"/></pattern>`)],
  ['checked', ['checked', 'checkered', 'chequered'], 'karirast', 'clothes', SRC.clothes, wrap('clothes', tankTop('url(#p-check)'),
    `<pattern id="p-check" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${W}"/><rect width="7" height="7" fill="${C}"/><rect x="7" y="7" width="7" height="7" fill="${C}"/></pattern>`)],
  ['floral', ['floral', 'flowery'], 'cvetličen', 'clothes', SRC.clothes, wrap('clothes', tankTop('url(#p-flower)'),
    `<pattern id="p-flower" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${M2}"/><g fill="${C}"><circle cx="6" cy="2.5" r="2.6"/><circle cx="9.5" cy="6" r="2.6"/><circle cx="6" cy="9.5" r="2.6"/><circle cx="2.5" cy="6" r="2.6"/></g><circle cx="6" cy="6" r="1.8" fill="${A}"/><g fill="${W}"><circle cx="18" cy="14.5" r="2.6"/><circle cx="21.5" cy="18" r="2.6"/><circle cx="18" cy="21.5" r="2.6"/><circle cx="14.5" cy="18" r="2.6"/></g><circle cx="18" cy="18" r="1.8" fill="${A}"/></pattern>`)],
  // shape and cut (task 3)
  ['flared-trousers', ['flared trousers', 'flares', 'flared'], 'zvončaste hlače', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 16 L84 16 L81 70 L96 114 L70 114 L66 70 L64 46 L62 70 L58 114 L32 114 L47 70 Z', D) + line('M44 26 L84 26') + thin('M53 34 L54 68 M75 34 L74 68', 2) + circ(64, 21, 2.2, W))],
  ['baggy-trousers', ['baggy trousers', 'baggy'], 'široke hlače', 'clothes', SRC.clothes, wrap('clothes',
    P('M42 16 L86 16 L100 70 L96 112 L68 112 L66 60 L64 50 L62 60 L60 112 L32 112 L28 70 Z', A2) + line('M42 26 L86 26') +
    thin('M40 40 Q46 60 38 90 M88 40 Q82 60 90 90 M50 70 Q54 86 50 104 M78 70 Q74 86 78 104', 2) + P('M40 56 L52 54 L52 68 L40 70 Z', A))],
  ['platform-shoes', ['platform shoes', 'platforms', 'platform shoe'], 'čevlji s platformo', 'clothes', SRC.clothes, wrap('clothes',
    P('M30 66 Q34 44 50 48 L74 62 Q98 64 104 76 L104 80 L30 80 Z', C) + P('M24 80 L106 80 Q110 96 100 98 L56 98 L52 112 L28 112 Q24 112 24 106 Z', A2) +
    line('M56 98 L56 86') + thin('M58 60 L50 74 M66 64 L62 76', 2.4) + shine('M38 58 Q44 50 50 52'))],
  ['running-shoes', ['running shoes', 'trainers', 'sneakers', 'running shoe'], 'tekaški copati', 'clothes', SRC.clothes, wrap('clothes',
    P('M16 80 Q16 58 36 56 L56 50 Q66 64 86 66 Q108 68 112 84 L16 84 Z', M) + P('M14 84 L114 84 Q114 98 104 98 L22 98 Q14 98 14 90 Z', W) +
    `<path d="M30 76 Q60 72 92 76" fill="none" stroke="${W}" stroke-width="5"/>` + thin('M54 54 L62 64 M60 52 L68 62 M48 56 L56 66', 2.4) + thin('M20 92 L108 92', 2))],
  ['knee-length-skirt', ['knee-length skirt', 'knee length skirt'], 'krilo do kolen', 'clothes', SRC.clothes, wrap('clothes',
    P('M48 76 L48 108 L58 108 L58 76', SK) + P('M70 76 L70 108 L80 108 L80 76', SK) + P('M44 106 L60 106 L60 114 L40 114 Q40 108 44 106 Z', DK) + P('M68 106 L84 106 Q88 108 88 114 L68 114 Z', DK) +
    P('M46 16 L82 16 L82 26 L46 26 Z', V) + P('M46 26 L82 26 L98 80 L30 80 Z', V2) + thin('M56 28 L50 80 M64 28 L64 80 M72 28 L78 80', 2) +
    `<path d="M22 84 L106 84" fill="none" stroke="${C}" stroke-width="2.4" stroke-dasharray="4 4"/>`)],
  ['short-sleeved-shirt', ['short-sleeved shirt', 'short sleeved shirt'], 'srajca s kratkimi rokavi', 'clothes', SRC.clothes, wrap('clothes',
    P('M44 30 L24 46 L32 62 L46 54', S2) + P('M84 30 L104 46 L96 62 L82 54', S2) +
    P('M44 28 L84 28 L86 106 L42 106 Z', S2) + P('M50 26 L64 40 L78 26 L82 18 L64 30 L46 18 Z', W) + line('M64 38 L64 106') +
    circ(64, 52, 2.4, W) + circ(64, 66, 2.4, W) + circ(64, 80, 2.4, W) + circ(64, 94, 2.4, W) + P('M70 46 L80 46 L80 56 L70 56 Z', S))],

  // ── APPEARANCE AND BODY (Appearance.pdf, Mock test) ──
  ['stubble', ['stubble'], 'strnišče (nekajdnevna brada)', 'body', SRC.appear, wrap('body',
    shoulders() + ears() + head() + dots(64, 82, 22, 9, 70, '#6b5848', 1.2) + dots(42, 74, 6, 10, 18, '#6b5848', 1.2, 3) + dots(86, 74, 6, 10, 18, '#6b5848', 1.2, 5) +
    shortHair() + eyes() + nose() + smile(), '', false)],
  ['beard', ['beard'], 'brada', 'body', SRC.appear, wrap('body',
    shoulders(S2) + ears() + head() + P('M35 62 Q34 104 64 108 Q94 104 93 62 Q90 82 78 84 Q64 78 50 84 Q38 82 35 62 Z', BR) +
    P('M54 76 Q64 72 74 76 Q64 82 54 76 Z', '#b44a3a') + shortHair() + eyes() + nose(68), '', false)],
  ['moustache', ['moustache', 'mustache', 'droopy moustache'], 'brki', 'body', SRC.appear, wrap('body',
    shoulders(M2) + ears() + head() + P('M48 86 Q46 74 56 72 Q61 71 64 75 Q67 71 72 72 Q82 74 80 86 Q76 84 74 79 Q64 77 54 79 Q52 84 48 86 Z', BR) +
    shortHair() + eyes() + nose(66), '', false)],
  ['receding-hair', ['receding hair', 'receding hairline', 'balding'], 'plešast na čelu (umikajoči lasje)', 'body', SRC.appear, wrap('body',
    shoulders(A2) + ears() + head() + P('M33 64 Q30 34 40 28 Q44 40 48 46 Q40 50 37 66 Z', G) + P('M95 64 Q98 34 88 28 Q84 40 80 46 Q88 50 91 66 Z', G) +
    P('M54 26 Q64 22 74 26 Q70 32 64 32 Q58 32 54 26 Z', G) + eyes() + nose() + smile() + thin('M50 52 Q54 50 58 52 M70 52 Q74 50 78 52', 2.4), '', false)],
  ['freckles', ['freckles'], 'pege', 'body', SRC.appear, wrap('body',
    P('M30 62 Q30 24 64 24 Q98 24 98 62 L98 100 L30 100 Z', BR) + shoulders(C2) + ears() + head() +
    dots(48, 72, 9, 5, 12, '#c9783f', 1.5, 11) + dots(80, 72, 9, 5, 12, '#c9783f', 1.5, 13) + dots(64, 66, 6, 3, 5, '#c9783f', 1.3, 17) +
    P('M34 58 Q38 30 64 30 Q90 30 94 58 Q84 44 64 44 Q44 44 34 58 Z', BR) + eyes() + nose() + smile(), '', false)],
  ['ginger', ['ginger', 'ginger hair', 'red hair'], 'riđi lasje', 'body', SRC.appear, wrap('body',
    P('M28 64 Q26 22 64 22 Q102 22 100 64 L104 108 L84 108 L84 70 L44 70 L44 108 L24 108 Z', GI) + shoulders(M2) + ears() + head() +
    P('M34 58 Q36 28 64 28 Q92 28 94 58 Q86 42 70 44 Q56 36 44 46 Q38 50 34 58 Z', GI) + eyes() + nose() + smile() + `<path d="M40 40 Q50 32 60 32" fill="none" stroke="#ffb27a" stroke-width="3"/>`, '', false)],
  ['round-face', ['round face', 'round'], 'okrogel obraz', 'body', SRC.appear, wrap('body',
    shoulders(V3) + circ(64, 60, 32, SK) + circ(32, 62, 6, SK) + circ(96, 62, 6, SK) + P('M33 56 Q34 26 64 26 Q94 26 95 56 Q86 40 64 42 Q42 40 33 56 Z', BR) + eyes(62) + nose(70) + smile(78) +
    `<circle cx="64" cy="60" r="40" fill="none" stroke="${V}" stroke-width="2.4" stroke-dasharray="5 5"/>`, '', false)],
  ['oval-face', ['oval face', 'oval'], 'ovalen obraz', 'body', SRC.appear, wrap('body',
    shoulders(M2) + `<ellipse cx="64" cy="60" rx="24" ry="33" fill="${SK}"/>` + circ(40, 62, 5, SK) + circ(88, 62, 5, SK) + P('M40 54 Q38 24 64 25 Q90 24 88 54 Q82 36 64 38 Q46 36 40 54 Z', BR) +
    eyes(60) + nose(70) + smile(80) + `<ellipse cx="64" cy="60" rx="32" ry="42" fill="none" stroke="${V}" stroke-width="2.4" stroke-dasharray="5 5"/>`, '', false)],
  ['upturned-nose', ['upturned nose', 'turned-up nose', 'snub nose'], 'privihan nos', 'body', SRC.appear, wrap('body',
    P('M40 124 Q40 104 58 100 L76 100 Q92 104 94 124 Z', V3) + P('M58 86 L74 86 L74 102 L58 102 Z', SK2) +
    P('M42 40 Q56 22 78 28 Q90 34 90 50 L92 56 Q100 60 102 56 Q104 64 96 68 L90 68 Q92 72 89 76 Q91 79 87 82 Q86 92 74 94 L60 94 Q40 90 38 64 Q38 50 42 40 Z', SK) +
    P('M38 66 Q30 30 60 24 Q84 22 88 40 Q72 34 62 42 Q54 50 52 64 Q46 60 38 66 Z', BR) + circ(54, 64, 6, SK) + circ(78, 52, 3, I, ' stroke="none"') + line('M84 82 Q80 84 76 82') +
    arrow(116, 36, 104, 52), '', false)],
  ['plump', ['plump', 'chubby', 'fat', 'overweight', 'obese'], 'debelušen', 'body', SRC.appear, wrap('body',
    P('M50 98 L48 116 L60 116 L60 100 Z', D) + P('M68 100 L68 116 L80 116 L78 98 Z', D) +
    `<ellipse cx="33" cy="80" rx="7" ry="14" transform="rotate(18 33 80)" fill="${SK}"/><ellipse cx="95" cy="80" rx="7" ry="14" transform="rotate(-18 95 80)" fill="${SK}"/>` +
    `<ellipse cx="64" cy="76" rx="32" ry="28" fill="${C2}"/>` + circ(64, 32, 16, SK) + P('M48 28 Q50 14 64 14 Q78 14 80 28 Q72 22 64 22 Q56 22 48 28 Z', BR) +
    circ(58, 32, 2.2, I, ' stroke="none"') + circ(70, 32, 2.2, I, ' stroke="none"') + line('M59 38 Q64 42 69 38') + shine('M44 66 Q42 78 46 88'))],
  ['skinny', ['skinny', 'thin', 'underweight', 'slim', 'skin and bone'], 'suh, presuh', 'body', SRC.appear, wrap('body',
    P('M58 84 L56 116 L61 116 L63 88 Z', D) + P('M66 88 L67 116 L72 116 L71 84 Z', D) +
    P('M58 46 L46 82 L50 84 L60 56 Z', SK) + P('M70 46 L82 82 L78 84 L68 56 Z', SK) +
    P('M57 44 L71 44 L72 88 L56 88 Z', M) + circ(64, 30, 13, SK) + P('M51 27 Q53 15 64 15 Q75 15 77 27 Q70 21 64 22 Q58 21 51 27 Z', BR) +
    circ(59, 30, 2, I, ' stroke="none"') + circ(69, 30, 2, I, ' stroke="none"') + line('M60 36 Q64 38 68 36') +
    `<path d="M40 60 L48 60 M80 60 L88 60" fill="none" stroke="${V}" stroke-width="3"/>` + arrow(34, 60, 44, 60) + arrow(94, 60, 84, 60))],
  // body parts (Appearance, tasks 5 and 6)
  ['cheek', ['cheek', 'cheeks'], 'lice', 'body', SRC.appear, wrap('body',
    shoulders(V3) + ears() + head() + circ(48, 74, 9, '#ff9a9a', ' stroke="none" opacity=".75"') + circ(80, 74, 9, '#ff9a9a', ' stroke="none" opacity=".4"') + shortHair(BR2) + eyes() + nose() + smile(78) + arrow(14, 104, 40, 80), '', false)],
  ['eyebrows', ['eyebrows', 'eyebrow'], 'obrvi', 'body', SRC.appear, wrap('body',
    shoulders(M2) + ears() + head() + shortHair(I) + `<path d="M44 50 Q52 42 60 48 M68 48 Q76 42 84 50" fill="none" stroke="${I}" stroke-width="5.5"/>` + eyes(60) + nose() + `<ellipse cx="64" cy="79" rx="5" ry="4" fill="#b44a3a"/>` + arrow(108, 20, 88, 42), '', false)],
  ['toes', ['toes', 'toe'], 'prsti na nogi', 'body', SRC.appear, wrap('body',
    P('M40 118 Q34 76 46 58 Q64 46 84 58 Q94 78 88 118 Z', SK) + circ(44, 54, 8, SK) + circ(57, 44, 7, SK) + circ(70, 42, 6.5, SK) + circ(81, 46, 6, SK) + circ(90, 54, 5.5, SK) +
    `<g fill="${C}" stroke="none"><ellipse cx="44" cy="50" rx="4" ry="3"/><ellipse cx="57" cy="40" rx="3.5" ry="2.6"/><ellipse cx="70" cy="38.5" rx="3.2" ry="2.4"/><ellipse cx="81" cy="42.5" rx="3" ry="2.2"/><ellipse cx="90" cy="51" rx="2.6" ry="2"/></g>` + arrow(110, 18, 92, 38), '', true)],
  ['thumbs', ['thumbs', 'thumb', 'thumbs up', 'thumbs-up'], 'palec (dvignjen palec)', 'body', SRC.appear, wrap('body',
    P('M44 104 L84 104 L84 128 L44 128 Z', V2) + P('M50 64 Q46 40 52 26 Q56 16 64 18 Q72 22 70 34 L68 64 Z', SK) + P('M54 28 Q60 22 66 28 L65 36 L55 36 Z', '#ffe8d8') +
    `<rect x="38" y="58" width="58" height="50" rx="16" fill="${SK}"/>` + thin('M58 70 L92 70 M58 82 L92 82 M58 94 L90 94', 2.4) + thin('M50 66 Q46 80 52 92', 2.4))],
  ['heel', ['heel'], 'peta', 'body', SRC.appear, wrap('body',
    P('M18 96 Q16 72 30 68 L42 42 L62 42 L66 72 Q100 76 110 90 Q112 100 102 100 L26 100 Q18 100 18 96 Z', SK) + P('M38 30 L66 30 L64 46 L40 46 Z', V) +
    circ(28, 88, 7, C2) + shine('M24 84 Q26 82 28 83') + thin('M86 82 Q90 86 88 92 M96 84 Q100 88 98 94', 2) + arrow(16, 122, 24, 100))],
  ['lungs', ['lungs', 'lung'], 'pljuča', 'body', SRC.appear, wrap('body',
    P('M58 42 Q38 38 32 70 Q28 100 44 104 Q58 106 60 84 Z', C) + P('M70 42 Q90 38 96 70 Q100 100 84 104 Q70 106 68 84 Z', C) +
    P('M59 12 L69 12 L69 50 L59 50 Z', W) + thin('M59 20 L69 20 M59 28 L69 28 M59 36 L69 36', 2) + thin('M64 50 Q58 58 52 64 M64 50 Q70 58 76 64', 3) +
    shine('M40 62 Q36 76 40 92') + shine('M88 62 Q92 76 88 92'))],
  ['knee', ['knee', 'knees'], 'koleno', 'body', SRC.appear, wrap('body',
    P('M22 40 L48 30 L78 64 Q84 78 72 86 L62 112 L44 112 L54 82 Z', SK) + P('M16 32 L48 22 L56 44 L24 54 Z', V) + circ(70, 72, 10, SK2) +
    P('M40 110 L66 110 Q76 112 76 120 L40 120 Z', M) + arrow(110, 50, 86, 66))],

  // ── EQUIPMENT (Places to visit, task 4: Equipment) ──
  ['boots', ['boots', 'boot', 'hiking boots'], 'pohodni čevlji', 'gear', SRC.equip, wrap('gear',
    P('M34 22 L62 22 L64 66 Q92 66 102 86 L102 94 L28 94 Q26 58 34 22 Z', BR2) + P('M32 22 L64 22 L64 32 L32 32 Z', A) +
    P('M26 94 L104 94 L104 106 L26 106 Z', DK) + thin('M44 40 L58 36 M44 50 L60 46 M44 60 L62 56', 2.6) + thin('M30 100 L100 100', 2) + line('M64 66 Q70 78 64 94'))],
  ['skis', ['skis', 'ski'], 'smuči', 'gear', SRC.equip, wrap('gear',
    `<g transform="rotate(30 64 64)"><path d="M44 8 Q50 4 54 10 L54 118 L44 118 Z" fill="${C}"/><path d="M74 8 Q80 4 84 10 L84 118 L74 118 Z" fill="${C}"/><rect x="41" y="62" width="16" height="12" rx="3" fill="${DK}"/><rect x="71" y="62" width="16" height="12" rx="3" fill="${DK}"/><path d="M49 20 L49 110 M79 20 L79 110" fill="none" stroke="${W}" stroke-width="2.4"/></g>` +
    `<path d="M18 24 L40 112 M106 24 L92 112" fill="none" stroke="${DK}" stroke-width="3"/>` + circ(38, 104, 5, A, ' fill-opacity="1"') + circ(94, 104, 5, A))],
  ['goggles', ['goggles', 'ski goggles'], 'smučarska očala', 'gear', SRC.equip, wrap('gear',
    P('M10 58 Q64 48 118 58 L118 72 Q64 62 10 72 Z', V) +
    P('M28 44 Q64 32 100 44 Q108 64 98 82 Q80 90 64 76 Q48 90 30 82 Q20 64 28 44 Z', DK) +
    P('M34 50 Q64 40 94 50 Q100 64 94 76 Q80 82 64 70 Q48 82 34 76 Q28 64 34 50 Z', A) + P('M34 50 Q64 40 94 50 Q96 56 95 60 Q64 52 33 62 Q32 56 34 50 Z', '#ffcf5a') +
    shine('M42 56 L52 52'))],
  ['flippers', ['flippers', 'flipper', 'fins'], 'plavutke', 'gear', SRC.equip, wrap('gear', flipper(-20, -8) + flipper(22, 8))],
  ['suntan-lotion', ['suntan lotion', 'sun cream', 'suncream', 'sunscreen', 'sun lotion', 'sunblock', 'suntan cream'], 'krema za sončenje', 'gear', SRC.equip, wrap('gear',
    P('M52 16 L76 16 L76 36 L52 36 Z', C) + P('M44 36 L84 36 Q90 36 90 44 L90 104 Q90 112 82 112 L46 112 Q38 112 38 104 L38 44 Q38 36 44 36 Z', A2) +
    circ(64, 72, 13, A) + thin('M64 50 L64 54 M64 90 L64 94 M42 72 L46 72 M82 72 L86 72 M49 57 L52 60 M76 84 L79 87 M49 87 L52 84 M76 60 L79 57', 2.4) + shine('M46 46 L46 100'))],
  ['sunglasses', ['sunglasses'], 'sončna očala', 'gear', SRC.equip, wrap('gear',
    P('M14 50 L26 50 M102 50 L114 50', 'none') + line('M18 48 L14 60') + line('M110 48 L114 60') +
    P('M18 48 L58 48 Q60 72 46 80 Q26 84 20 66 Z', DK) + P('M70 48 L110 48 L108 66 Q102 84 82 80 Q68 72 70 48 Z', DK) + line('M58 52 Q64 46 70 52') +
    `<path d="M28 56 L40 54 M80 56 L92 54" fill="none" stroke="${S2}" stroke-width="3.4"/>` + line('M14 48 L114 48'))],
  ['sandals', ['sandals', 'sandal'], 'sandali', 'gear', SRC.equip, wrap('gear', sandal(-6, -22, C2) + sandal(2, 4, C))],
  ['sleeping-bag', ['sleeping bag', 'sleeping-bag'], 'spalna vreča', 'gear', SRC.equip, wrap('gear',
    P('M12 70 Q12 46 34 44 L104 52 Q118 54 118 70 Q118 86 104 88 L34 96 Q12 94 12 70 Z', V) + `<ellipse cx="30" cy="70" rx="11" ry="16" fill="${V3}"/>` +
    thin('M52 48 Q56 70 52 94 M70 50 Q74 70 70 92 M88 51 Q92 70 88 90 M104 53 Q107 70 104 87', 2.4) + `<path d="M40 50 Q44 72 40 94" fill="none" stroke="${A}" stroke-width="2.4"/>` + shine('M60 54 L100 58'))],
  ['sun-hat', ['sun hat', 'sunhat'], 'klobuk za sonce', 'gear', SRC.equip, wrap('gear',
    `<ellipse cx="64" cy="82" rx="52" ry="15" fill="${A2}"/>` + P('M38 82 Q38 44 64 44 Q90 44 90 82 Q64 90 38 82 Z', A2) + P('M38 70 Q64 78 90 70 L90 80 Q64 88 38 80 Z', C) +
    P('M86 74 L102 66 L100 80 Z', C) + P('M86 76 L100 90 L88 92 Z', C) + thin('M24 84 Q64 98 104 84', 2))],
  ['tent', ['tent'], 'šotor', 'gear', SRC.equip, wrap('gear',
    P('M64 24 L110 104 L18 104 Z', A) + P('M64 24 L84 104 L44 104 Z', DK) + P('M64 24 L76 104 L56 104 Z', '#ffcc5c') + P('M64 24 L66 104 L48 104 Z', DK) +
    line('M64 24 L64 12') + P('M64 12 L80 17 L64 22 Z', C) + thin('M18 104 L6 112 M110 104 L122 112', 2.4) + line('M10 104 L118 104'))],
  ['first-aid-kit', ['first-aid kit', 'first aid kit', 'first-aid box'], 'prva pomoč (torbica)', 'gear', SRC.equip, wrap('gear',
    line('M48 40 L48 30 Q48 24 54 24 L74 24 Q80 24 80 30 L80 40') + `<rect x="20" y="40" width="88" height="66" rx="12" fill="${C}"/>` +
    P('M56 52 L72 52 L72 64 L84 64 L84 80 L72 80 L72 92 L56 92 L56 80 L44 80 L44 64 L56 64 Z', W) + line('M20 54 L108 54'))],
  ['swimming-costume', ['swimming costume', 'swimsuit', 'bathing suit', 'swimming suit', 'swimming-costume'], 'kopalke (enodelne)', 'gear', SRC.equip, wrap('gear',
    P('M46 14 L54 14 Q58 34 64 34 Q70 34 74 14 L82 14 Q86 46 86 58 Q86 80 96 102 Q80 108 64 98 Q48 108 32 102 Q42 80 42 58 Q42 46 46 14 Z', S) +
    `<path d="M44 62 Q54 56 64 62 T84 62 M42 78 Q52 72 62 78 T84 78" fill="none" stroke="${W}" stroke-width="3"/>`)],
  ['camera', ['camera'], 'fotoaparat', 'gear', SRC.equip, wrap('gear',
    P('M42 40 L48 28 L72 28 L78 40 Z', G) + `<rect x="16" y="40" width="96" height="62" rx="12" fill="${G}"/>` + line('M16 54 L112 54') +
    circ(64, 72, 22, DK) + circ(64, 72, 13, S) + circ(59, 67, 4, W, ' stroke="none"') + `<rect x="88" y="44" width="14" height="7" rx="2" fill="${A2}" stroke-width="2"/>` + circ(28, 47, 3, C))],
  ['mosquito-repellent', ['mosquito repellent', 'insect repellent', 'repellent'], 'sredstvo proti komarjem', 'gear', SRC.equip, wrap('gear',
    `<rect x="56" y="34" width="38" height="76" rx="9" fill="${M}"/>` + `<rect x="64" y="20" width="22" height="14" rx="3" fill="${W}"/>` + `<rect x="54" y="24" width="10" height="5" rx="2" fill="${W}" stroke-width="2"/>` +
    circ(75, 74, 14, W) + `<g stroke-width="2"><ellipse cx="75" cy="76" rx="2.5" ry="6" fill="${DK}"/><ellipse cx="70" cy="70" rx="5" ry="2.4" fill="${S2}"/><ellipse cx="80" cy="70" rx="5" ry="2.4" fill="${S2}"/></g>` +
    `<path d="M65 64 L85 84" fill="none" stroke="${C}" stroke-width="3.4"/>` + `<circle cx="75" cy="74" r="14" fill="none" stroke="${C}" stroke-width="3.4"/>` +
    dots(34, 26, 12, 8, 10, G, 1.8, 2))],
  ['gas-stove', ['portable gas stove', 'gas stove', 'camping stove', 'stove'], 'prenosni plinski gorilnik', 'gear', SRC.equip, wrap('gear',
    P('M40 74 L88 74 L90 108 Q64 116 38 108 Z', S) + `<ellipse cx="64" cy="74" rx="24" ry="6" fill="${S2}"/>` + `<rect x="58" y="62" width="12" height="10" fill="${G}"/>` +
    line('M44 60 L56 62 M84 60 L72 62') + `<ellipse cx="64" cy="60" rx="18" ry="3" fill="${G}"/>` +
    P('M64 22 Q78 38 72 52 Q70 58 64 58 Q58 58 56 52 Q50 38 64 22 Z', A) + P('M64 38 Q70 46 67 53 Q64 56 61 53 Q58 46 64 38 Z', C) + `<path d="M50 92 L78 92" fill="none" stroke="${W}" stroke-width="3"/>`)],

  // ── TRAVEL (Travel, holidays; Places to visit; Mock test) ──
  ['ferry', ['ferry'], 'trajekt', 'travel', SRC.travel2, wrap('travel',
    P('M80 22 L92 22 L92 50 L80 50 Z', C) + P('M38 36 L78 36 L82 50 L34 50 Z', W) + P('M24 50 L100 50 L104 72 L20 72 Z', W) +
    Array.from({ length: 7 }, (_, i) => circ(32 + i * 10.6, 61, 3, S2, ' stroke-width="2"')).join('') + P('M12 72 L116 72 L104 96 L24 96 Z', S) + line('M18 82 L110 82') +
    `<path d="M4 104 Q14 98 24 104 T44 104 T64 104 T84 104 T104 104 T124 104" fill="none" stroke="${S}" stroke-width="3"/>`, '', false)],
  ['lorry', ['lorry', 'truck'], 'tovornjak', 'travel', SRC.travel2, wrap('travel',
    `<rect x="12" y="32" width="68" height="54" rx="4" fill="${A}"/>` + thin('M26 40 L26 78 M40 40 L40 78 M54 40 L54 78 M68 40 L68 78', 2) +
    P('M80 46 L100 46 L114 64 L114 86 L80 86 Z', C) + P('M86 52 L98 52 L107 64 L86 64 Z', S2) + line('M10 86 L116 86') +
    circ(30, 90, 10, DK) + circ(30, 90, 3.5, W) + circ(56, 90, 10, DK) + circ(56, 90, 3.5, W) + circ(98, 90, 10, DK) + circ(98, 90, 3.5, W))],
  ['double-decker', ['double-decker', 'double decker', 'double-decker bus', 'double decker bus'], 'dvonadstropni avtobus', 'travel', SRC.travel2, wrap('travel',
    `<rect x="12" y="20" width="104" height="76" rx="12" fill="${C}"/>` +
    [20, 42, 64, 86].map((x) => `<rect x="${x}" y="28" width="18" height="18" rx="3" fill="${S2}"/>`).join('') +
    [42, 64, 86].map((x) => `<rect x="${x}" y="56" width="18" height="18" rx="3" fill="${S2}"/>`).join('') + `<rect x="20" y="56" width="14" height="32" rx="2" fill="${S2}"/>` +
    line('M12 50 L116 50') + `<rect x="96" y="80" width="12" height="6" rx="2" fill="${A2}" stroke-width="2"/>` + circ(36, 98, 10, DK) + circ(36, 98, 3.5, W) + circ(94, 98, 10, DK) + circ(94, 98, 3.5, W))],
  ['steering-wheel', ['steering wheel', 'steering-wheel'], 'volan', 'travel', SRC.travel2, wrap('travel',
    `<path d="M64 20 A44 44 0 1 1 63.9 20 Z M64 32 A32 32 0 1 0 64.1 32 Z" fill="${DK}" fill-rule="evenodd"/>` +
    P('M33 60 Q64 52 95 60 L95 70 Q78 70 72 80 L72 96 L56 96 L56 80 Q50 70 33 70 Z', DK) + circ(64, 66, 11, V) + circ(64, 66, 4, W, ' stroke="none"') + shine('M34 40 Q44 28 58 26'))],
  ['tyre', ['tyre', 'tire'], 'pnevmatika', 'travel', SRC.travel2, wrap('travel',
    `<path d="M64 18 A44 44 0 1 1 63.9 18 Z M64 42 A20 20 0 1 0 64.1 42 Z" fill="${DK}" fill-rule="evenodd"/>` + `<circle cx="64" cy="62" r="20" fill="${G}"/>` + circ(64, 62, 6, G2) +
    Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${(64 + Math.cos(a) * 36).toFixed(1)} ${(62 + Math.sin(a) * 36).toFixed(1)} L${(64 + Math.cos(a) * 43).toFixed(1)} ${(62 + Math.sin(a) * 43).toFixed(1)}" fill="none" stroke="#6b7099" stroke-width="3"/>` }).join('') +
    [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 - 1.57; return circ(+(64 + Math.cos(a) * 12).toFixed(1), +(62 + Math.sin(a) * 12).toFixed(1), 2, DK, ' stroke="none"') }).join(''))],
  ['puncture', ['puncture', 'flat tyre', 'flat tire'], 'predrta guma', 'travel', SRC.travel2, wrap('travel',
    P('M24 100 Q14 96 18 66 A46 46 0 0 1 110 66 Q114 96 104 100 Z', DK) + `<circle cx="64" cy="62" r="20" fill="${G}"/>` + circ(64, 62, 6, G2) +
    thin('M24 100 Q64 108 104 100', 2) + `<path d="M84 26 L96 40" fill="none" stroke="${G}" stroke-width="4.5"/>` + `<path d="M79 21 L89 30" fill="none" stroke="${I}" stroke-width="6"/>` +
    `<path d="M102 30 Q108 26 112 30 M104 40 Q112 38 116 42 M100 20 Q104 14 110 16" fill="none" stroke="${S}" stroke-width="2.6"/>` + line('M6 106 L122 106'), '', false)],
  ['tram', ['tram', 'streetcar'], 'tramvaj', 'travel', SRC.travel2, wrap('travel',
    line('M6 14 L122 14') + line('M56 14 L64 28 L72 14') + line('M64 28 L64 36') +
    `<rect x="14" y="36" width="100" height="58" rx="14" fill="${M}"/>` + [24, 46, 68, 90].map((x) => `<rect x="${x}" y="46" width="16" height="20" rx="3" fill="${S2}"/>`).join('') +
    line('M14 74 L114 74') + circ(36, 96, 7, DK) + circ(92, 96, 7, DK) + line('M4 104 L124 104') + thin('M10 110 L118 110', 2), '', false)],
  ['fishing-boat', ['fishing boat'], 'ribiški čoln', 'travel', SRC.travel2, wrap('travel',
    line('M42 18 L42 74') + line('M42 26 L22 60') + `<path d="M24 58 L42 74 L30 74 Z" fill="${A2}" stroke-width="2"/>` + thin('M26 62 L36 72 M30 60 L40 70 M28 66 L34 66', 1.6) +
    `<rect x="58" y="50" width="30" height="24" rx="4" fill="${W}"/>` + `<rect x="64" y="56" width="8" height="8" fill="${S2}" stroke-width="2"/>` + `<rect x="76" y="56" width="8" height="8" fill="${S2}" stroke-width="2"/>` +
    P('M14 74 L114 74 L100 98 L28 98 Z', C) + line('M20 82 L108 82') + `<path d="M4 104 Q14 98 24 104 T44 104 T64 104 T84 104 T104 104 T124 104" fill="none" stroke="${S}" stroke-width="3"/>`, '', false)],
  ['petrol-station', ['petrol station', 'gas station', 'filling station'], 'bencinska črpalka', 'travel', SRC.travel2, wrap('travel',
    `<rect x="10" y="12" width="108" height="14" rx="5" fill="${V}"/>` + line('M22 26 L22 104 M106 26 L106 104') +
    `<rect x="40" y="40" width="38" height="64" rx="6" fill="${C}"/>` + `<rect x="47" y="48" width="24" height="16" rx="2" fill="${S2}"/>` + P('M59 74 Q66 82 66 87 Q66 93 59 93 Q52 93 52 87 Q52 82 59 74 Z', W) +
    thin('M78 52 Q96 54 94 74 L94 86', 3) + P('M90 84 L98 84 L98 96 L90 96 Z', DK) + `<rect x="34" y="102" width="50" height="8" rx="2" fill="${G}"/>`)],
  ['jet', ['jet', 'plane', 'aeroplane', 'airplane'], 'reaktivno letalo', 'travel', SRC.travel2, wrap('travel',
    P('M54 58 L42 34 L54 34 L74 58 Z', S) + P('M18 58 L12 38 L24 38 L34 58 Z', C) +
    P('M12 64 Q12 56 24 56 L100 56 Q118 58 120 64 Q118 72 100 72 L24 72 Q12 72 12 64 Z', W) +
    Array.from({ length: 6 }, (_, i) => circ(40 + i * 9, 62, 2.4, S, ' stroke="none"')).join('') + P('M100 58 Q110 60 114 64 L102 64 Z', S2) +
    P('M54 66 L40 96 L54 96 L78 66 Z', S) + `<rect x="54" y="74" width="14" height="7" rx="3" fill="${G}" stroke-width="2"/>`)],
  ['sports-car', ['sports car', 'sportscar'], 'športni avto', 'travel', SRC.travel2, wrap('travel',
    P('M10 82 Q12 68 30 66 L48 52 Q64 46 82 52 L98 64 Q116 66 118 80 L118 88 L10 88 Z', C) + P('M52 56 Q64 50 78 56 L90 64 L46 64 Z', S2) + line('M66 52 L66 64') +
    `<path d="M24 76 L104 76" fill="none" stroke="${W}" stroke-width="3"/>` + P('M110 72 L118 72 L118 78 L110 78 Z', A2) +
    circ(34, 88, 12, DK) + circ(34, 88, 4, G) + circ(94, 88, 12, DK) + circ(94, 88, 4, G))],
  ['traffic-jam', ['traffic jam', 'jam', 'traffic'], 'prometni zamašek', 'travel', SRC.travel1, wrap('travel',
    line('M4 56 L124 56') + `<path d="M4 88 L124 88" fill="none" stroke="${G}" stroke-dasharray="8 6"/>` +
    car(-20, 30, V) + car(34, 30, A) + car(88, 30, M) + car(-4, 64, C) + car(50, 64, S) + car(104, 64, V2) +
    `<g fill="${C}" stroke="none"><rect x="24" y="44" width="5" height="4" rx="1"/><rect x="78" y="44" width="5" height="4" rx="1"/><rect x="40" y="78" width="5" height="4" rx="1"/><rect x="94" y="78" width="5" height="4" rx="1"/></g>` + thin('M30 98 L98 98', 2) + `<path d="M50 14 Q56 8 62 14 M66 14 Q72 8 78 14" fill="none" stroke="${C}" stroke-width="3"/>`, '', false)],
  ['passport', ['passport'], 'potni list', 'travel', SRC.travel1, wrap('travel',
    `<rect x="32" y="16" width="64" height="94" rx="7" fill="${V}"/>` + line('M40 16 L40 110') +
    `<g stroke="${A2}"><circle cx="68" cy="56" r="17" fill="none"/><path d="M51 56 L85 56 M68 39 Q56 56 68 73 Q80 56 68 39" fill="none" stroke-width="2.4"/></g>` +
    `<rect x="52" y="86" width="32" height="5" rx="2" fill="${A2}" stroke="none"/>` + `<rect x="58" y="95" width="20" height="4" rx="2" fill="${A2}" stroke="none"/>`)],
  ['suitcase', ['suitcase'], 'kovček', 'travel', SRC.travel1, wrap('travel',
    line('M50 40 L50 28 Q50 22 56 22 L72 22 Q78 22 78 28 L78 40') + `<rect x="24" y="40" width="80" height="62" rx="10" fill="${A}"/>` +
    P('M40 40 L48 40 L48 102 L40 102 Z', BR2) + P('M80 40 L88 40 L88 102 L80 102 Z', BR2) + circ(64, 62, 8, M, ' stroke-width="2"') + `<rect x="56" y="80" width="16" height="10" rx="2" fill="${C2}" stroke-width="2"/>` +
    circ(34, 106, 4, DK) + circ(94, 106, 4, DK))],
  ['boarding-card', ['boarding card', 'boarding pass'], 'vstopni kupon (letalski)', 'travel', SRC.travel1, wrap('travel',
    P('M12 36 L116 36 L116 54 Q108 64 116 74 L116 94 L12 94 L12 74 Q20 64 12 54 Z', W) + P('M12 36 L116 36 L116 48 L12 48 Z', V) +
    `<path d="M88 52 L88 90" fill="none" stroke="${G}" stroke-dasharray="3 4"/>` + thin('M94 56 L94 86 M98 56 L98 86 M101 56 L101 86 M106 56 L106 86 M109 56 L109 86', 2) +
    P('M30 66 L48 60 L60 52 L64 54 L58 62 L70 60 L74 56 L76 58 L72 66 L60 70 Z', V) + thin('M24 80 L50 80 M24 86 L42 86 M58 80 L78 80', 2.4), '', false)],
  ['balcony', ['balcony'], 'balkon', 'travel', SRC.travel1, wrap('travel',
    `<rect x="18" y="12" width="92" height="120" rx="4" fill="#ffe7c2"/>` + `<rect x="42" y="22" width="44" height="58" rx="3" fill="${S2}"/>` + line('M64 22 L64 80') +
    `<rect x="20" y="80" width="88" height="8" rx="2" fill="${G}"/>` + line('M22 58 L106 58') + thin('M30 58 L30 80 M40 58 L40 80 M50 58 L50 80 M60 58 L60 80 M70 58 L70 80 M80 58 L80 80 M90 58 L90 80 M100 58 L100 80', 2.4) +
    P('M88 46 L100 46 L98 56 L90 56 Z', C) + circ(90, 42, 4, M) + circ(97, 40, 4, M), '', false)],
  ['twin-room', ['twin room', 'twin'], 'dvoposteljna soba z ločenima posteljama', 'travel', SRC.travel1, wrap('travel', bed(14, 44, 1) + bed(70, 44, 1) + `<rect x="58" y="70" width="12" height="20" rx="2" fill="${BR2}"/>` + circ(64, 64, 5, A2))],
  ['double-room', ['double room', 'double'], 'dvoposteljna soba z zakonsko posteljo', 'travel', SRC.travel1, wrap('travel', bed(20, 88, 2))],
  ['backpacker', ['backpacker', 'backpackers'], 'popotnik z nahrbtnikom', 'travel', SRC.mock, wrap('travel',
    `<rect x="64" y="30" width="32" height="56" rx="9" fill="${C}"/>` + `<rect x="62" y="22" width="36" height="11" rx="5.5" fill="${A2}"/>` + `<rect x="70" y="60" width="20" height="14" rx="3" fill="${C2}" stroke-width="2"/>` +
    P('M50 88 L46 116 L56 116 L60 94 L64 116 L74 116 L72 88 Z', D) + P('M48 44 L72 44 L74 90 L46 90 Z', M) + line('M66 44 L66 90') +
    P('M48 46 L38 76 L44 78 L52 58', SK) + circ(60, 30, 11, SK) + P('M48 28 Q50 16 62 16 Q72 16 72 26 L80 28 L48 30 Z', V))],
  ['desert-island', ['desert island', 'island'], 'samoten otok', 'travel', SRC.travel2, wrap('travel',
    circ(104, 24, 10, A) + P('M4 96 Q34 90 64 96 T124 96 L124 124 L4 124 Z', S2) + `<ellipse cx="64" cy="94" rx="40" ry="10" fill="${SAND}"/>` +
    P('M60 94 Q54 66 68 40 L74 42 Q62 68 68 94 Z', BR2) +
    P('M71 40 Q56 28 38 36 Q54 34 70 42 Z', M) + P('M71 40 Q86 26 104 34 Q88 34 72 43 Z', M) + P('M71 40 Q60 46 52 62 Q64 50 73 43 Z', M) + P('M71 40 Q84 46 90 60 Q80 50 72 43 Z', M) + P('M71 40 Q72 26 66 18 Q76 26 73 41 Z', M) +
    circ(66, 46, 3.4, BR) + circ(73, 47, 3.4, BR), '', false)],
  ['snow-capped-mountain', ['snow-capped mountain', 'snow-capped mountains', 'snowcapped mountain', 'mountain'], 'zasnežena gora', 'travel', SRC.travel2, wrap('travel',
    circ(28, 28, 9, A) + P('M84 44 L120 104 L48 104 Z', '#a9b0d0') + P('M84 44 L95 62 L88 58 L82 64 L76 58 L73 62 Z', W) +
    P('M50 24 L96 104 L4 104 Z', '#8890bd') + P('M50 24 L64 48 L56 44 L50 52 L44 44 L36 48 Z', W) + line('M2 104 L126 104'), '', false)],
  ['ruins', ['ruins'], 'ruševine', 'travel', SRC.travel1, wrap('travel',
    P('M8 104 L120 104 L120 112 L8 112 Z', '#d9c9a0') +
    `<rect x="18" y="34" width="18" height="70" fill="#f1e4c4"/>` + `<rect x="14" y="28" width="26" height="8" fill="#e3d2a6"/>` + thin('M23 40 L23 100 M31 40 L31 100', 2) +
    P('M52 60 L70 60 L70 104 L52 104 Z', '#f1e4c4') + P('M52 60 L56 52 L62 58 L66 50 L70 60 Z', '#f1e4c4') + thin('M57 64 L57 100 M65 64 L65 100', 2) +
    `<rect x="86" y="48" width="18" height="56" fill="#f1e4c4"/>` + `<rect x="82" y="42" width="26" height="8" fill="#e3d2a6"/>` + thin('M91 54 L91 100 M99 54 L99 100', 2) +
    P('M72 96 L94 92 L96 104 L74 104 Z', '#e3d2a6') + P('M10 104 Q14 96 18 104 M108 104 Q112 94 116 104', M), '', false)],
  ['castle', ['castle'], 'grad', 'travel', SRC.travel1, wrap('travel',
    P('M14 50 L14 40 L20 40 L20 46 L26 46 L26 40 L32 40 L32 46 L38 46 L38 40 L44 40 L44 108 L14 108 Z', '#c9cde6') +
    P('M84 50 L84 40 L90 40 L90 46 L96 46 L96 40 L102 40 L102 46 L108 46 L108 40 L114 40 L114 108 L84 108 Z', '#c9cde6') +
    P('M44 58 L44 50 L52 50 L52 56 L60 56 L60 50 L68 50 L68 56 L76 56 L76 50 L84 50 L84 108 L44 108 Z', '#dfe2f3') +
    P('M54 108 L54 86 Q64 74 74 86 L74 108 Z', BR2) + `<rect x="25" y="62" width="8" height="12" rx="4" fill="${DK}"/>` + `<rect x="95" y="62" width="8" height="12" rx="4" fill="${DK}"/>` +
    line('M99 40 L99 20') + P('M99 20 L114 25 L99 30 Z', C) + line('M8 108 L120 108'), '', false)],
]

export const PICS: Pic[] = DEFS.map(([id, en, slo, cat, src, svg]) => ({ id, en, slo, cat, src, svg: svg.split('__ID__').join(id) }))
export const PIC_BY_ID: Record<string, Pic> = Object.fromEntries(PICS.map((p) => [p.id, p]))
