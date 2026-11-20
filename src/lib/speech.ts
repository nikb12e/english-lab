// Izgovorjava, zgrajena za zanesljivost (kot Duolingo):
// 1) Vsak posnetek ima stalen naslov (SHA-256 besedila), zato ga aplikacija najprej prenese NEPOSREDNO iz shrambe (0,2 s).
//    Strežnik (ElevenLabs v4 Turbo) pokliče samo, če posnetka še ni.
// 2) Posnetki se prenesejo v pomnilnik vnaprej (naslednje naloge), predvaja se iz pomnilnika, zato zvok začne takoj.
// 3) Vse gre skozi en sam, enkrat odklenjen predvajalnik (pogoj za iOS). Če iOS predvajanje zavrne, ga ob naslednjem dotiku ponovi.
// 4) Novejše branje vedno prekine starejše; robotski glas brskalnika samo, če strežnik res ne deluje (po oddaji).
import { supabase, SUPABASE_URL } from './supabase'

const MAX = 400
const TTS_MODEL = 'elevenlabs/eleven-v4-turbo'
const VOICE = 'george'
const STORE = `${SUPABASE_URL}/storage/v1/object/public/tts/`
const norm = (s: string) => s.trim().slice(0, MAX).trim()

let voices: SpeechSynthesisVoice[] = []
function loadVoices() { try { voices = window.speechSynthesis?.getVoices() || [] } catch { voices = [] } }
if (typeof window !== 'undefined' && window.speechSynthesis) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices }
const hasSynth = () => typeof window !== 'undefined' && !!window.speechSynthesis
export const canSpeak = () => typeof window !== 'undefined' && (typeof Audio !== 'undefined' || hasSynth())

function synth(text: string, lang = 'en-GB') {
  if (!hasSynth()) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    const v = voices.find((x) => x.lang === lang) || voices.find((x) => x.lang.startsWith(lang.slice(0, 2)))
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  } catch { /* brez zvoka */ }
}

/* ───────── en predvajalnik, odklenjen ob prvem dotiku ───────── */
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABwAAA2AAVVVVVVVVVVVVVVVVVVVxcXFxcXFxcXFxcXFxcY6Ojo6Ojo6Ojo6Ojo6Oqqqqqqqqqqqqqqqqqqqqx8fHx8fHx8fHx8fHx8fj4+Pj4+Pj4+Pj4+Pj4///////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQEIAAAAAAAAANgmVBi7QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'
let main: HTMLAudioElement | null = null
let unlocked = false
let retryOnTap: { src: string; rate: number; my: number } | null = null
function el() {
  if (!main) {
    main = new Audio()
    main.preload = 'auto'
    try { (main as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true } catch { /* */ }
  }
  return main
}
if (typeof window !== 'undefined') {
  try { (navigator as Navigator & { audioSession?: { type: string } }).audioSession!.type = 'playback' } catch { /* */ }
  const onTap = () => {
    const a = el()
    if (retryOnTap) {
      const r = retryOnTap
      retryOnTap = null
      if (r.my === seq) { a.src = r.src; a.playbackRate = r.rate; void a.play().then(() => { unlocked = true }, () => { /* */ }) }
      return
    }
    if (unlocked) return
    if (!a.src || a.src === location.href || a.src === SILENT) {
      a.src = SILENT
      void a.play().then(() => { unlocked = true }, () => { /* */ })
    } else unlocked = true
  }
  window.addEventListener('pointerdown', onTap, { capture: true, passive: true })
  window.addEventListener('touchend', onTap, { capture: true, passive: true })
  window.addEventListener('keydown', onTap, { capture: true })
}

function stop() {
  try { const a = el(); if (!a.paused) a.pause() } catch { /* */ }
  try { window.speechSynthesis?.cancel() } catch { /* */ }
}

async function play(src: string, rate: number, my: number): Promise<boolean> {
  const a = el()
  for (let attempt = 0; attempt < 2; attempt++) {
    if (my !== seq) return true
    try {
      if (a.src !== src) a.src = src
      try { a.currentTime = 0 } catch { /* */ }
      a.playbackRate = rate
      try { a.volume = 1 } catch { /* */ }
      await a.play()
      unlocked = true
      return true
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'NotAllowedError') { retryOnTap = { src, rate, my }; return true }
      if (name !== 'AbortError') return false
      await new Promise((r) => setTimeout(r, 60))
    }
  }
  return false
}

/* ───────── posnetki v pomnilniku ───────── */
const mem = new Map<string, string>() // ključ -> blob: URL
const loading = new Map<string, Promise<string | null>>()
function keep(k: string, obj: string) {
  mem.set(k, obj)
  if (mem.size > 120) {
    const [old, url] = mem.entries().next().value as [string, string]
    mem.delete(old)
    try { URL.revokeObjectURL(url) } catch { /* */ }
  }
}
async function fetchBlob(url: string, timeout = 12000): Promise<string | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) return null
    const b = await r.blob()
    if (b.size < 200) return null
    return URL.createObjectURL(b.type.startsWith('audio') ? b : new Blob([b], { type: 'audio/mpeg' }))
  } catch { return null } finally { clearTimeout(t) }
}
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

// strežniški klici: največ 2 hkrati, nujni (trenutna naloga) gredo pred vnaprejšnje
let active = 0
const waiting: { urgent: boolean; go: () => void }[] = []
function slot(urgent: boolean): Promise<() => void> {
  return new Promise((res) => {
    const go = () => { active++; res(() => { active--; const n = waiting.shift(); if (n) n.go() }) }
    if (active < 2) go()
    else if (urgent) waiting.unshift({ urgent, go })
    else waiting.push({ urgent, go })
  })
}
let aiDown = 0
async function generate(t: string, urgent: boolean): Promise<string | null> {
  if (Date.now() < aiDown) return null
  const { data: s } = await supabase.auth.getSession()
  if (!s.session || !SUPABASE_URL) return null
  const release = await slot(urgent)
  try {
    for (let i = 0; i < 2; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('ai', { body: { action: 'tts', text: t } })
        if (!error && data?.url) return data.url as string
        if ((error as { context?: { status?: number } } | null)?.context?.status === 429) break
      } catch { /* poskusi znova */ }
      await new Promise((r) => setTimeout(r, 400))
    }
    aiDown = Date.now() + 60_000
    return null
  } finally { release() }
}

/** Pripravi posnetek besedila v pomnilnik: najprej iz shrambe, sicer ga ustvari strežnik. */
export function prepare(text: string, urgent = false): Promise<string | null> {
  const t = norm(text)
  if (!t) return Promise.resolve(null)
  const hit = mem.get(t)
  if (hit) return Promise.resolve(hit)
  const p0 = loading.get(t)
  if (p0) return p0
  const p = (async () => {
    let obj: string | null = null
    if (SUPABASE_URL) {
      const direct = STORE + (await sha(`${TTS_MODEL}|${VOICE}|${t}`)) + '.mp3'
      obj = await fetchBlob(direct, 8000)
    }
    if (!obj) {
      const url = await generate(t, urgent)
      if (url) obj = await fetchBlob(url)
    }
    if (obj) keep(t, obj)
    return obj
  })()
  loading.set(t, p)
  void p.finally(() => loading.delete(t))
  return p
}

/* ───────── glagoli (posnetki v aplikaciji) ───────── */
// Posnetke glagolov (public/audio/v2/<glagol>.mp3) repozitorij ne vsebuje. Ko jih dodaš, nastavi na true.
// Brez njih aplikacija uporabi glas brskalnika.
const HAS_VERB_AUDIO = false
const verbUrl = (id: string) => `/audio/v2/${encodeURIComponent(id)}.mp3`
function prepVerb(id: string): Promise<string | null> {
  if (!HAS_VERB_AUDIO) return Promise.resolve(null)
  const k = 'verb:' + id
  const hit = mem.get(k)
  if (hit) return Promise.resolve(hit)
  const p0 = loading.get(k)
  if (p0) return p0
  const p = fetchBlob(verbUrl(id), 8000).then((o) => { if (o) keep(k, o); return o })
  loading.set(k, p)
  void p.finally(() => loading.delete(k))
  return p
}
export function prefetchVerb(id: string) { void prepVerb(id) }
export async function speakVerb(id: string, fallback: string) {
  const my = ++seq
  stop()
  const obj = await prepVerb(id)
  if (my !== seq) return
  if (!obj || !(await play(obj, 1, my))) { if (my === seq) synth(fallback) }
}

/* ───────── branje ───────── */
let seq = 0
/** Prebere pravilno različico po oddaji. Počaka na ElevenLabs glas (do 15 s), dokler si na tej nalogi.
 *  Robotski glas samo, če strežnik res ne deluje. */
export async function speak(text: string, rate = 1.06) {
  const t = norm(text)
  if (!t) return
  const my = ++seq
  stop()
  const obj = mem.get(t) || (await Promise.race([prepare(t, true), new Promise<null>((r) => setTimeout(() => r(null), 15000))]))
  if (my !== seq) return
  if (obj && (await play(obj, rate, my))) return
  if (my === seq) synth(t)
}

/** Prebere navodilo naloge, še preden odgovoriš (vrzel je kratek premor). Brez robotskega glasu. */
export async function speakTask(text: string) {
  const t = norm(text)
  if (!t) return
  const my = ++seq
  stop()
  const obj = mem.get(t) || (await Promise.race([prepare(t, true), new Promise<null>((r) => setTimeout(() => r(null), 15000))]))
  if (my !== seq || !obj) return
  await play(obj, 1.04, my)
}

/** Iz naloge z vrzeljo naredi besedilo za branje pred odgovorom: na mestu vrzeli reče »blank« in namig, kaj vstaviti
 *  (glagol v oklepaju ali infinitiv), da slišiš celo nalogo, ne samo premora. Slovenska navodila se ne berejo. */
export function gapText(q: string, hint?: string): string | null {
  if (!q || /[čšžČŠŽ]|^(Napiši|Write the|What is the opposite)/.test(q)) return null
  let t = q.replace(/\b[AB]:\s*/g, '')
  t = t.replace(/_{2,}\s*\(([^)]*)\)/, (_, h: string) => ` … blank, ${h.replace(/,/g, '')} … `)
  if (/_{2,}/.test(t)) t = t.replace(/_{2,}/, hint ? ` … blank, ${hint} … ` : ' … blank … ')
  t = t.replace(/_{2,}/g, ' … ').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/…\s*([.,!?])/g, '…$1').replace(/\s{2,}/g, ' ').trim()
  if (t.split(' ').length < 4) return null
  return t.slice(0, MAX)
}

/** Iz naloge z vrzeljo naredi celo angleško poved s pravilnim odgovorom; slovenska navodila se ne berejo. */
export function fullSentence(q: string, ans: string): string | null {
  if (/[čšžČŠŽ]|^(Napiši|Write the|What is the opposite)/.test(q)) return null
  let t = q.includes('___') ? q.replace('___', ans.replace(/^– \(no article\)$/, '').trim()) : (ans ? null : q)
  if (!t) return null
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())
  t = t.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\b[AB]:\s*/g, '').replace(/\s+([.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim()
  if (t.split(' ').length < 4 || /___/.test(t)) return null
  return t.slice(0, MAX)
}

/** Kaj se prebere po oddaji: vedno pravilna različica. Najprej cela poved, sicer vsaj pravilna beseda. */
export function correctSpoken(q: string, answer: string): string | null {
  const a = answer.trim()
  if (a.length > 28) return fullSentence(a, '') || a.slice(0, MAX)
  const full = fullSentence(q, a)
  if (full) return full
  if (!a || /^– \(no article\)$/.test(a) || /[čšžČŠŽ]/.test(a)) return null
  return a
}

/** Takoj prekine branje (npr. ob zaprtju vaje). */
export function hush() { ++seq; retryOnTap = null; stop() }

/** Ob prehodu na novo nalogo: zvok mehko utihne (0,2 s), nato se ustavi. */
export function fadeOut(ms = 200) {
  const mine = ++seq
  retryOnTap = null
  try { window.speechSynthesis?.cancel() } catch { /* */ }
  const a = el()
  if (a.paused) return
  const start = performance.now()
  const tick = () => {
    if (mine !== seq) return // že predvaja novo branje: ne utišaj ga
    const k = Math.min(1, (performance.now() - start) / ms)
    try { a.volume = Math.max(0, 1 - k) } catch { /* iOS ne dovoli spreminjati glasnosti */ }
    if (k < 1 && !a.paused) requestAnimationFrame(tick)
    else { try { a.pause(); a.volume = 1 } catch { /* */ } }
  }
  requestAnimationFrame(tick)
}

export function haptic(kind: 'ok' | 'bad') {
  try { navigator.vibrate?.(kind === 'ok' ? 12 : [18, 40, 18]) } catch { /* */ }
}
