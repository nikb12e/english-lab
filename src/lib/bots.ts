// Računalniški tekmeci: na lestvici in v areni. Vse je deterministično (isto seme = enak rezultat na vseh napravah),
// zato vsi uporabniki vidijo iste tekmece z istimi točkami, brez strežnika in brez lažnih računov v bazi.
import { levelOf, rating } from './adaptive'
import { VERBS } from './verbs'
import type { PubStats, Row } from './league'

/** Hiter psevdonaključni generator s semenom (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const BOT_NAMES = ['Lana', 'Maks', 'Ema', 'Tilen', 'Zala', 'Jaka', 'Neža', 'Vid', 'Tjaša', 'Luka', 'Ajda', 'Gal', 'Pia', 'Rok', 'Lea', 'Matic', 'Sara', 'Nejc', 'Kaja', 'Žan', 'Iza', 'Jure', 'Hana', 'Bor', 'Manca', 'Aljaž', 'Tara', 'Lovro', 'Klara', 'Urban', 'Brina', 'Domen']
export const isBot = (id: string) => id.startsWith('bot:')

/* ───────── lestvica ───────── */
const LEAGUE_BOTS = 6
const weekNum = (week: string) => { const [y, w] = week.split('-W').map(Number); return y * 53 + w }

interface BotProfile { id: string; name: string; theta: number; weekly: number; activity: number; hour: number; k0: number; kRate: number; streak0: number; acc: number; since: number }
function botProfile(i: number): BotProfile {
  const r = rng(hash('league-bot-' + i))
  const order = [...BOT_NAMES].sort((a, b) => hash('n' + a) - hash('n' + b))
  return {
    id: 'bot:' + i,
    name: order[i % order.length],
    theta: -0.6 + r() * 1.7,
    weekly: 1500 + r() * 3000, // povprečen učenec: 1,5k do 4,5k XP na teden
    activity: 0.5 + r() * 0.42, // verjetnost, da na dan vadi
    hour: 13 + r() * 8, // ura začetka vadbe
    k0: 8 + Math.floor(r() * 40),
    kRate: 3 + r() * 9,
    streak0: 1 + Math.floor(r() * 9),
    acc: 0.7 + r() * 0.22,
    since: 3 + Math.floor(r() * 6), // tednov nazaj
  }
}

/** XP bota za dan d (0 = ponedeljek) v tednu; za tekoči dan samo del, ki je že »odvadil«. */
function dayXp(b: BotProfile, week: string, d: number, todayIdx: number, hourNow: number): number {
  if (d > todayIdx) return 0
  const r = rng(hash(`${b.id}|${week}|${d}`))
  if (r() > b.activity) return 0
  const full = Math.round((b.weekly / (7 * b.activity)) * (0.5 + r()))
  if (d < todayIdx) return full
  const start = b.hour + r() * 2
  return Math.round(full * Math.max(0, Math.min(1, (hourNow - start) / 1.6)))
}

function weekDaysXp(b: BotProfile, week: string, current: boolean, now = new Date()) {
  const todayIdx = current ? (now.getDay() + 6) % 7 : 6
  const hourNow = current ? now.getHours() + now.getMinutes() / 60 : 24
  return Array.from({ length: 7 }, (_, d) => dayXp(b, week, d, todayIdx, hourNow))
}

const prevWeek = (week: string, k: number) => {
  const n = weekNum(week) - k
  const y = Math.floor(n / 53), w = n % 53 || 53
  return `${w === 53 ? y - 1 : y}-W${String(w).padStart(2, '0')}`
}

/** Tekmeci za tekoči teden, z oblikovano statistiko, ki je videti kot pri resničnem učencu. */
export function leagueBots(week: string, now = new Date()): Row[] {
  return Array.from({ length: LEAGUE_BOTS }, (_, i) => {
    const b = botProfile(i)
    const days = weekDaysXp(b, week, true, now)
    const xp = days.reduce((a, x) => a + x, 0)
    const weeksIn = Math.max(1, b.since + (weekNum(week) % 7))
    const known = Math.min(VERBS.length, Math.round(b.k0 + b.kRate * weeksIn))
    const todayIdx = (now.getDay() + 6) % 7
    let streak = 0
    for (let d = todayIdx; d >= 0 && days[d] > 0; d--) streak++
    if (streak && streak === todayIdx + 1) streak += b.streak0
    const total = known * 11 + Math.round(b.weekly / 6)
    const r = rng(hash(b.id + week))
    const stats: PubStats = {
      lvl: levelOf(b.theta), rt: rating(b.theta), known, cards: Math.round(known * (0.5 + r() * 0.6)),
      total, correct: Math.round(total * b.acc), min: Math.round(total * 0.11),
      best: Math.max(streak, b.streak0 + 3 + Math.floor(r() * 6)), sprint: 9 + Math.floor(b.theta * 6 + r() * 10),
      acc14: Math.round((b.acc + (r() - 0.5) * 0.04) * 100), n14: 60 + Math.floor(r() * 300), days,
      active30: Math.round(30 * b.activity * (0.8 + r() * 0.2)), since: null,
    }
    return { user_id: b.id, name: b.name, xp, known, streak, stats }
  })
}

/** Zadnjih 8 tednov za profil tekmeca. */
export function botWeeks(id: string, week: string): { week: string; xp: number }[] {
  const b = botProfile(Number(id.split(':')[1]) || 0)
  return Array.from({ length: Math.min(8, b.since + 1) }, (_, k) => {
    const w = prevWeek(week, Math.min(8, b.since + 1) - 1 - k)
    const xs = weekDaysXp(b, w, w === week)
    return { week: w, xp: xs.reduce((a, x) => a + x, 0) }
  })
}
