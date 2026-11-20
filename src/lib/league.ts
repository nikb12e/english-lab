// Weekly leaderboard: every signed in user has one row per week (ISO week), XP is summed from the daily log.
// XP rewards learning, not grinding: correct due and new verbs give the most, repeating what you already know gives little.
import { supabase } from './supabase'
import { getState, type Profile } from './store'
import { VERBS } from './verbs'
import { maturity } from './fsrs'
import { levelOf, rating } from './adaptive'
import { leagueBots, botWeeks, isBot } from './bots'

/** ISO week in local time, e.g. 2026-W46. */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Days of the current week (Mon … Sun) as YYYY-MM-DD. */
export function weekDays(d = new Date()) {
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return ymd(x) })
}

export const weekXp = (p: Profile) => weekDays().reduce((a, k) => a + (p.days[k]?.x || 0), 0)
export const todayXp = (p: Profile) => p.days[ymd(new Date())]?.x || 0

/** Until the second the week ends (Sunday 24:00). */
export function weekEndsIn(now = new Date()) {
  const end = new Date(now)
  end.setDate(now.getDate() + (7 - ((now.getDay() + 6) % 7)))
  end.setHours(0, 0, 0, 0)
  return end.getTime() - now.getTime()
}

/** XP for one answer. */
export function xpFor(o: { ok: boolean; placement: boolean; firstTime: boolean; wasDue: boolean; wasNew: boolean; becameKnown: boolean; kind: string }) {
  if (o.placement) return o.ok ? 5 : 1
  let x: number
  if (!o.firstTime) x = o.ok ? 4 : 1 // a repeat or confirmation after a mistake
  else if (!o.ok) x = 2 // effort counts, but only a little
  else x = o.wasNew || o.wasDue ? 10 : 3 // grinding something known that is not due yet is not worth it
  if (o.becameKnown) x += 5
  return x
}

// common Slovenian (and some foreign) first names: an email that starts with a name without a separator (e.g. “janeznovak”) gives the real name
const NAMES = 'nik,nika,niko,nikolaj,luka,jan,žan,zan,tim,tine,tilen,tadej,tomaž,tomaz,matic,matija,matej,mark,marko,miha,mihael,jure,jaka,jakob,jernej,jošt,jost,gal,gašper,gasper,anže,anze,aljaž,aljaz,blaž,blaz,david,domen,erik,filip,gregor,jon,jost,klemen,kristjan,lovro,maks,martin,mitja,nejc,oskar,peter,primož,primoz,rok,rene,sašo,saso,simon,sven,urban,urh,val,vid,vito,žiga,ziga,ažbe,azbe,adam,alen,andraž,andraz,andrej,bor,boris,dejan,denis,enej,ian,igor,jaša,jasa,kevin,leon,lan,luka,mai,mark,maj,nace,nal,nejc,patrik,svit,teo,timotej,tjaš,tjas,lara,lea,lana,eva,ema,zala,zoja,ana,anja,tjaša,tjasa,maja,mia,nina,neža,neza,nuša,nusa,pia,sara,sofia,sofija,špela,spela,tara,tina,tia,urša,ursa,vita,živa,ziva,julija,klara,lucija,manca,meta,nika,petra,katja,katarina,karin,kaja,hana,iza,ajda,alja,brina,gaja,ines,inja,jana,jera,kiara,laura,lina,lena,mojca,naja,ota,polona,rebeka,saša,sasa,taja,teja,ula,vesna,zarja,žana,zana'.split(',').sort((a, b) => b.length - a.length)
const JUNK = new Set(['info', 'mail', 'email', 'admin', 'test', 'user', 'official', 'real', 'the', 'its', 'me', 'my', 'yt', 'youtube', 'youtub', 'gaming', 'game', 'pro', 'xd', 'ai', 'dev', 'contact', 'hello', 'hi', 'dijak', 'ucenec', 'student', 'mr', 'mrs', 'ms', 'noreply', 'office', 'support', 'account', 'school', 'sola'])
const DIAC: Record<string, string> = { ziga: 'žiga', zan: 'žan', anze: 'anže', aljaz: 'aljaž', blaz: 'blaž', gasper: 'gašper', tomaz: 'tomaž', primoz: 'primož', saso: 'sašo', andraz: 'andraž', jasa: 'jaša', tjas: 'tjaš', tjasa: 'tjaša', neza: 'neža', nusa: 'nuša', spela: 'špela', ursa: 'urša', ziva: 'živa', sasa: 'saša', zana: 'žana', azbe: 'ažbe', jost: 'jošt' }
const cap = (w0: string) => { const w = DIAC[w0] || w0; return w.charAt(0).toUpperCase() + w.slice(1) }

/** Name from an email address: “first.last@…” → First; “janeznovak@…” → Janez (if it starts with a known name); otherwise the first meaningful part. */
export function nameFromEmail(email?: string | null): string | null {
  if (!email) return null
  const local = email.split('@')[0].toLowerCase().replace(/\+.*$/, '')
  let parts = local.split(/[._\-\d]+/).filter((p) => p.length >= 2 && /^[a-zčšž]+$/.test(p) && !JUNK.has(p))
  if (!parts.length) {
    // everything was “junk”: take the longest meaningful part (at least 3 letters); the database uses the same rule (name_from_email)
    const best = local.split(/[._\-\d+]+/).filter((p) => p.length >= 3 && /^[a-zčšž]+$/.test(p) && !['info', 'mail', 'admin', 'test', 'user', 'noreply', 'office', 'support', 'contact'].includes(p)).sort((a, b) => b.length - a.length)[0]
    if (!best) return null
    parts = [best]
  }
  for (const p of parts) if (NAMES.includes(p)) return cap(p)
  const glued = parts[0]
  const pre = NAMES.find((n) => n.length >= 3 && glued.startsWith(n) && glued.length - n.length >= 4)
  if (pre) return cap(pre)
  if (parts[0].length > 14) return null
  return cap(parts[0])
}

export function defaultName() {
  const s = getState().session
  const p = getState().profile
  if (p.name) return p.name
  const full = (s?.user.user_metadata?.full_name || s?.user.user_metadata?.name || '') as string
  if (full.trim()) return full.trim().split(/\s+/)[0].slice(0, 24)
  const fromMail = nameFromEmail(s?.user.email)
  if (fromMail) return fromMail.slice(0, 24)
  return 'Learner ' + (s?.user.id || '0000').slice(0, 4).toUpperCase()
}

/** Public stats for a leaderboard profile (no email or other personal data). */
export interface PubStats {
  lvl: string; rt: number; known: number; cards: number; total: number; correct: number; min: number
  best: number; sprint: number; acc14: number | null; n14: number; days: number[]; active30: number; since: string | null
}
export interface Row { user_id: string; name: string; xp: number; known: number; streak: number; stats?: Partial<PubStats> }

export function buildStats(): PubStats {
  const st = getState()
  const p = st.profile
  const keys = Object.keys(p.days).sort()
  let n14 = 0, c14 = 0, active30 = 0
  const now = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const k = ymd(d)
    const lg = p.days[k]
    if (lg?.n) active30++
    if (i < 14 && lg) { n14 += lg.n || 0; c14 += lg.c || 0 }
  }
  const cards = Object.entries(st.items).filter(([k, c]) => k.startsWith('c:') && maturity(c) === 'mature').length
  return {
    lvl: levelOf(p.theta), rt: rating(p.theta),
    known: VERBS.filter((v) => maturity(st.items['v:' + v.id]) === 'mature').length,
    cards, total: p.total || 0, correct: p.correct || 0, min: Math.round((p.time || 0) / 60),
    best: p.best || 0, sprint: p.sprintBest || 0,
    acc14: n14 >= 5 ? Math.round((c14 / n14) * 100) : null, n14,
    days: weekDays().map((k) => p.days[k]?.x || 0), active30, since: keys[0] || null,
  }
}

let pushTimer = 0
let lastPushed = ''
/** Sends your weekly XP to the leaderboard (with a delay so it does not call on every answer). */
export function scheduleLeaguePush(delay = 4000) {
  clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => { void pushLeague() }, delay)
}
export async function pushLeague() {
  const st = getState()
  if (!st.session) return
  const week = isoWeek()
  if (!st.settings.league) {
    await supabase.from('league').delete().eq('user_id', st.session.user.id)
    lastPushed = ''
    return
  }
  const known = VERBS.filter((v) => maturity(st.items['v:' + v.id]) === 'mature').length
  const row = { user_id: st.session.user.id, week, name: defaultName(), xp: Math.min(50000, weekXp(st.profile)), known, streak: Math.min(5000, st.profile.streak || 0), stats: buildStats() }
  const sig = JSON.stringify(row)
  if (sig === lastPushed) return
  const { error } = await supabase.from('league').upsert({ ...row, updated_at: new Date().toISOString() })
  if (!error) lastPushed = sig
}

export async function fetchLeague(): Promise<Row[] | null> {
  const { data, error } = await supabase.from('league').select('user_id,name,xp,known,streak,stats').eq('week', isoWeek()).order('xp', { ascending: false }).limit(50)
  if (error) return null
  // opponents fill the leaderboard so it stays lively even when few people practise (names do not clash with real ones)
  const real = data as Row[]
  const taken = new Set(real.map((r) => r.name.toLowerCase()))
  const bots = leagueBots(isoWeek()).filter((b) => !taken.has(b.name.toLowerCase()))
  return [...real, ...bots].sort((a, b) => b.xp - a.xp)
}

/** A member's weekly XP for the last 8 weeks (for the chart on the profile). */
export async function fetchWeeks(userId: string): Promise<{ week: string; xp: number }[]> {
  if (isBot(userId)) return botWeeks(userId, isoWeek())
  const { data } = await supabase.from('league').select('week,xp').eq('user_id', userId).order('week', { ascending: false }).limit(8)
  return ((data as { week: string; xp: number }[]) || []).reverse()
}
