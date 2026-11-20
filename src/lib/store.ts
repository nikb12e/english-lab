import { useSyncExternalStore } from 'react'
import { supabase, type Session } from './supabase'
import type { MemState } from './fsrs'
import type { TopicId } from '../data/types'
import type { Difficulty } from './adaptive'

export type VerbMode = 'forms' | 'inf' | 'mix'

export interface Settings {
  verbMode: VerbMode
  newVerbs: number
  /** how many new verbs come at once; the next group only when all started verbs are mastered */
  verbBatch: number
  newCards: number
  retention: number
  difficulty: Difficulty
  sound: boolean
  speech: boolean
  topics: TopicId[]
  /** taking part in the weekly leaderboard */
  league: boolean
}

export interface DayLog { n: number; c: number; t: number; x?: number }

export interface Profile {
  streak: number
  best: number
  lastDay: string
  newDay: string
  newVerbs: number
  newCards: number
  days: Record<string, DayLog>
  total: number
  correct: number
  time: number
  sprintBest: number
  /** most words solved in a crossword */
  xwBest?: number
  theta: number
  thetaN: number
  placed: boolean
  bAdj: Record<string, number>
  /** display name on the leaderboard */
  name?: string
  /** mistake estimate by task type (see lib/weak.ts) */
  weak?: Record<string, { e: number; n: number; t: number }>
}

export const DEFAULT_SETTINGS: Settings = {
  verbMode: 'forms',
  newVerbs: 10,
  verbBatch: 5,
  league: true,
  newCards: 6,
  retention: 0.9,
  difficulty: 'hard',
  sound: true,
  speech: true,
  topics: ['verbs', 'present', 'articles', 'nouns', 'vocab'],
}
/** Learning settings are no longer optional: values recommended by FSRS and recall research. Difficulty adjusts itself. */
const AUTO: Partial<Settings> = { retention: 0.9, verbBatch: 5, newCards: 6, difficulty: 'normal' }

/** Anyone who had all the old topics selected automatically gets the new vocabulary topic too. */
const fixS = (s: Settings): Settings => (s.topics.length === 4 && !s.topics.includes('vocab') ? { ...s, topics: [...s.topics, 'vocab'] } : s)

export const DEFAULT_PROFILE: Profile = {
  streak: 0, best: 0, lastDay: '', newDay: '', newVerbs: 0, newCards: 0, days: {}, total: 0, correct: 0, time: 0, sprintBest: 0,
  theta: 0, thetaN: 0, placed: false, bAdj: {},
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

interface State {
  items: Record<string, MemState>
  settings: Settings
  profile: Profile
  settingsU: number
  profileU: number
  session: Session | null
  authReady: boolean
  sync: SyncStatus
  lastSync: number
}

const GUEST = 'guest'
const lsKey = (uid: string) => `englishlab:v1:${uid}`
const metaKey = (uid: string) => `englishlab:meta:${uid}`

let state: State = {
  items: {},
  settings: { ...DEFAULT_SETTINGS },
  profile: { ...DEFAULT_PROFILE },
  settingsU: 0,
  profileU: 0,
  session: null,
  authReady: false,
  sync: 'local',
  lastSync: 0,
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}
export const getState = () => state
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => sel(state),
  )
}

const uidNow = () => state.session?.user.id || GUEST

function loadLocal(uid: string) {
  try {
    const raw = localStorage.getItem(lsKey(uid))
    if (!raw) return null
    return JSON.parse(raw) as Pick<State, 'items' | 'settings' | 'profile' | 'settingsU' | 'profileU'>
  } catch {
    return null
  }
}
let saveTimer = 0
function saveLocal() {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      const { items, settings, profile, settingsU, profileU } = state
      localStorage.setItem(lsKey(uidNow()), JSON.stringify({ items, settings, profile, settingsU, profileU }))
    } catch {
      /* full or unavailable localStorage: the data stays in memory and in the cloud */
    }
  }, 150)
}
function applyLocal(uid: string) {
  const l = loadLocal(uid)
  set({
    items: l?.items || {},
    settings: fixS({ ...DEFAULT_SETTINGS, ...(l?.settings || {}), ...AUTO }),
    profile: { ...DEFAULT_PROFILE, ...(l?.profile || {}) },
    settingsU: l?.settingsU || 0,
    profileU: l?.profileU || 0,
  })
}

// ───────────── mutations ─────────────
const dirty = new Set<string>()
export function putItem(key: string, s: MemState) {
  set({ items: { ...state.items, [key]: s } })
  dirty.add(key)
  saveLocal()
  schedulePush()
}
export function setSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch }, settingsU: Date.now() })
  dirty.add('_settings')
  saveLocal()
  schedulePush()
}
export function updateProfile(fn: (p: Profile) => Profile) {
  set({ profile: fn(state.profile), profileU: Date.now() })
  dirty.add('_profile')
  saveLocal()
  schedulePush()
}
export async function resetAll() {
  const keys = Object.keys(state.items)
  set({ items: {}, profile: { ...DEFAULT_PROFILE }, profileU: Date.now() })
  saveLocal()
  if (state.session) {
    const uid = state.session.user.id
    for (let i = 0; i < keys.length; i += 200) {
      await supabase.from('progress').delete().eq('user_id', uid).in('key', keys.slice(i, i + 200))
    }
    dirty.add('_profile')
    schedulePush()
  }
}
/** Progress import (e.g. from the old claude.ai app). Merges by time of change. */
export function importItems(items: Record<string, MemState>, profile?: Partial<Profile>) {
  const merged = { ...state.items }
  for (const [k, v] of Object.entries(items)) {
    const cur = merged[k]
    if (!cur || (v.u || 0) > (cur.u || 0) || (!cur.reps && v.reps)) {
      merged[k] = v
      dirty.add(k)
    }
  }
  set({ items: merged })
  if (profile) {
    const p = state.profile
    const days = { ...(profile.days || {}), ...p.days }
    set({
      profile: {
        ...p,
        days,
        total: Math.max(p.total, profile.total || 0),
        correct: Math.max(p.correct, profile.correct || 0),
        best: Math.max(p.best, profile.best || 0),
        streak: Math.max(p.streak, profile.streak || 0),
        lastDay: p.lastDay > (profile.lastDay || '') ? p.lastDay : profile.lastDay || p.lastDay,
      },
      profileU: Date.now(),
    })
    dirty.add('_profile')
  }
  saveLocal()
  schedulePush()
}

// ───────────── sync with Supabase ─────────────
let pushTimer = 0
let pushing = false
function schedulePush() {
  if (!state.session) return
  clearTimeout(pushTimer)
  pushTimer = window.setTimeout(push, 1200)
}
function rowFor(key: string) {
  if (key === '_settings') return { key, data: state.settings, updated_at: new Date(state.settingsU || Date.now()).toISOString() }
  if (key === '_profile') return { key, data: state.profile, updated_at: new Date(state.profileU || Date.now()).toISOString() }
  const it = state.items[key]
  if (!it) return null
  return { key, data: it, updated_at: new Date(it.u || Date.now()).toISOString() }
}
async function push() {
  if (!state.session || pushing || !dirty.size) return
  if (!navigator.onLine) return set({ sync: 'offline' })
  pushing = true
  const keys = [...dirty]
  dirty.clear()
  set({ sync: 'syncing' })
  const rows = keys.map(rowFor).filter(Boolean) as { key: string; data: unknown; updated_at: string }[]
  let failed = false
  for (let i = 0; i < rows.length; i += 300) {
    const { error } = await supabase.from('progress').upsert(rows.slice(i, i + 300), { onConflict: 'user_id,key' })
    if (error) {
      failed = true
      keys.forEach((k) => dirty.add(k))
      break
    }
  }
  pushing = false
  set({ sync: failed ? 'error' : 'synced', lastSync: failed ? state.lastSync : Date.now() })
  if (!failed) localStorage.setItem(metaKey(uidNow()), String(Date.now()))
  if (dirty.size) schedulePush()
}

async function pullAll(): Promise<boolean> {
  if (!state.session) return false
  set({ sync: 'syncing' })
  const all: { key: string; data: any; updated_at: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('progress').select('key,data,updated_at').range(from, from + 999)
    if (error) {
      set({ sync: navigator.onLine ? 'error' : 'offline' })
      return false
    }
    all.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const items = { ...state.items }
  let { settings, profile, settingsU, profileU } = state
  const remoteKeys = new Set<string>()
  for (const r of all) {
    const ru = Date.parse(r.updated_at)
    remoteKeys.add(r.key)
    if (r.key === '_settings') {
      if (ru > settingsU) { settings = fixS({ ...DEFAULT_SETTINGS, ...r.data, ...AUTO }); settingsU = ru }
      else if (settingsU > ru) dirty.add('_settings')
    } else if (r.key === '_profile') {
      if (ru > profileU) { profile = { ...DEFAULT_PROFILE, ...r.data }; profileU = ru }
      else if (profileU > ru) dirty.add('_profile')
    } else {
      const cur = items[r.key]
      if (!cur || ru > (cur.u || 0)) items[r.key] = { ...r.data, u: ru }
      else if ((cur.u || 0) > ru) dirty.add(r.key)
    }
  }
  for (const k of Object.keys(items)) if (!remoteKeys.has(k)) dirty.add(k)
  if (!remoteKeys.has('_settings') && settingsU) dirty.add('_settings')
  if (!remoteKeys.has('_profile') && profileU) dirty.add('_profile')
  set({ items, settings, profile, settingsU, profileU, sync: 'synced', lastSync: Date.now() })
  saveLocal()
  if (dirty.size) schedulePush()
  return true
}

async function onSession(session: Session | null) {
  const prevUid = state.session?.user.id
  if (session?.user.id === prevUid && state.authReady) {
    set({ session })
    return
  }
  set({ session, authReady: true })
  if (!session) {
    applyLocal(GUEST)
    set({ sync: 'local' })
    return
  }
  const uid = session.user.id
  const hadLocal = !!loadLocal(uid)
  applyLocal(uid)
  // first sign in on this device: move the guest progress into the account
  if (!hadLocal) {
    const guest = loadLocal(GUEST)
    if (guest && Object.keys(guest.items || {}).length) {
      set({
        items: guest.items,
        settings: fixS({ ...DEFAULT_SETTINGS, ...guest.settings, ...AUTO }),
        profile: { ...DEFAULT_PROFILE, ...guest.profile },
        settingsU: guest.settingsU,
        profileU: guest.profileU,
      })
      try { localStorage.removeItem(lsKey(GUEST)) } catch { /* */ }
    }
  }
  await pullAll()
}

export async function initStore() {
  applyLocal(GUEST)
  const { data } = await supabase.auth.getSession()
  await onSession(data.session)
  supabase.auth.onAuthStateChange((_e, s) => {
    void onSession(s)
  })
  window.addEventListener('online', () => {
    if (state.session) void pullAll()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session && Date.now() - state.lastSync > 60_000) void pullAll()
    if (document.visibilityState === 'hidden') void push()
  })
  if (!state.authReady) set({ authReady: true })
}

export async function signOut() {
  await push()
  await supabase.auth.signOut()
}
export const syncNow = () => pullAll()
