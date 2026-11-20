import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { initStore, useStore, importItems } from './lib/store'
import type { MemState } from './lib/fsrs'
import { Session } from './components/Session'
import { Arena } from './components/Arena'
import { Sprint } from './components/Sprint'
import { Crossword } from './components/Crossword'
import { Intro } from './components/Intro'
import { ProfilePage } from './components/Profile'
import { Welcome } from './components/Welcome'
import { Flame, Zap } from 'lucide-react'
import { weekXp, defaultName } from './lib/league'
import { topUpTests } from './lib/content'
import { aiOn } from './lib/ai'
import { onLlmChange } from './lib/llm'
import { getState } from './lib/store'
import { TabBar, Sheet, VerbDetail, Toast, type Tab } from './components/ui'
import { Today, Practice, Verbs, Progress, type Nav } from './views/views'
import { VERB_BY_ID } from './lib/verbs'
import { verbItem, type QItem } from './lib/content'
import { setSoundEnabled } from './lib/sound'

const TAB_HASH: Record<Tab, string> = { today: '', practice: 'practice', verbs: 'verbs', progress: 'progress' }
const tabFromHash = (): Tab => {
  const h = location.hash.replace('#', '')
  return (Object.entries(TAB_HASH).find(([, v]) => v && v === h)?.[0] as Tab) || 'today'
}

/** Progress from the old claude.ai app arrives in #import=… (base64url JSON). */
function readImport(): { items: Record<string, MemState>; profile?: any } | null {
  const m = location.hash.match(/import=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
    const items: Record<string, MemState> = {}
    const now = Date.now()
    for (const [id, c] of Object.entries<any>(json.cards || {})) {
      if (!VERB_BY_ID[id] || !c?.reps) continue
      items['v:' + id] = {
        S: c.S, D: c.D, reps: c.reps, lapses: c.lapses || 0, last: c.last, due: c.due, seen: c.seen || 0, correct: c.correct || 0,
        errs: c.errs || {}, hist: c.hist || [], u: Math.max(c.last || 0, now - 1000),
      }
    }
    return { items, profile: json.profile }
  } catch {
    return null
  }
}

function BrandMark() {
  return <span className="brand-glyph" aria-hidden="true">✦</span>
}

const introSeen = () => { try { return sessionStorage.getItem('el:intro') === '1' } catch { return false } }

// open source version: no sign in, progress stays in this browser
const devGuest = true

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [run, setRun] = useState<{ items: QItem[]; title: string; id: number; grow?: boolean } | null>(null)
  const [sprint, setSprint] = useState(false)
  const [xw, setXw] = useState(false)
  const [arena, setArena] = useState(0)
  useEffect(() => { const h = () => setArena(Date.now()); window.addEventListener('el:arena', h); return () => window.removeEventListener('el:arena', h) }, [])
  const [verb, setVerb] = useState<string | null>(null)
  const [account, setAccount] = useState(false)
  const [intro, setIntro] = useState(() => !introSeen() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const authReady = useStore((s) => s.authReady)
  const session = useStore((s) => s.session)
  const sound = useStore((s) => s.settings.sound)

  useEffect(() => setSoundEnabled(sound), [sound])
  // with an AI key: fetch fresh test tasks in the background where they are running out (stored in this browser)
  const [aiKeyOn, setAiKeyOn] = useState(aiOn())
  useEffect(() => onLlmChange(() => setAiKeyOn(aiOn())), [])
  useEffect(() => {
    if (!aiKeyOn) return
    const t = setTimeout(() => { void topUpTests(getState().items, 2) }, 4000)
    return () => clearTimeout(t)
  }, [aiKeyOn])

  const toast = useCallback((m: string) => {
    setToastMsg(m)
    window.setTimeout(() => setToastMsg((x) => (x === m ? null : x)), 3200)
  }, [])

  const endIntro = useCallback(() => {
    try { sessionStorage.setItem('el:intro', '1') } catch { /* private mode */ }
    setIntro(false)
  }, [])

  useEffect(() => {
    const imp = readImport()
    const authErr = new URLSearchParams(location.hash.slice(1) || location.search).get('error_description')
    void initStore().then(() => {
      if (imp && Object.keys(imp.items).length) {
        importItems(imp.items, imp.profile)
        toast(`Progress imported from the old app: ${Object.keys(imp.items).length} records.`)
      }
      if (authErr) toast('Sign in failed: ' + authErr.replace(/\+/g, ' '))
      if (imp || authErr) history.replaceState(null, '', location.pathname)
    })
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [toast])

  const go = (t: Tab) => {
    setTab(t)
    history.replaceState(null, '', TAB_HASH[t] ? '#' + TAB_HASH[t] : location.pathname)
    window.scrollTo({ top: 0 })
  }

  const closeProfile = useCallback(() => setAccount(false), [])
  const nav: Nav = {
    start: (items, title, grow) => {
      if (!items.length) return toast('Nothing to practise right now.')
      setVerb(null)
      setRun({ items, title, id: Date.now(), grow })
    },
    sprint: () => setSprint(true),
    cross: () => setXw(true),
    arena: () => setArena(Date.now()),
    openVerb: (id) => setVerb(id),
    toast,
  }

  const name = session ? defaultName() : ''
  const avatar = session?.user.user_metadata?.avatar_url as string | undefined
  const items = useStore((s) => s.items)
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <AnimatePresence>{intro && <Intro key="intro" onDone={endIntro} />}</AnimatePresence>

      {authReady && !session && !devGuest && <Welcome />}

      {authReady && (session || devGuest) && (
        <motion.main className="shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: 'easeOut' as const, delay: intro ? 2.3 : 0 }}>
          <div className="topbar">
            <div className="brand"><BrandMark />English Lab</div>
            <div className="top-r">
              <button className={'pill stat' + (profile.streak ? ' lit' : '')} onClick={() => setAccount(true)} aria-label={`${profile.streak || 0} day streak`}>
                <Flame />{profile.streak || 0}
              </button>
              <button className="pill stat xp" onClick={() => setAccount(true)} aria-label={`${weekXp(profile)} XP this week`}>
                <Zap />{weekXp(profile)}
              </button>
              <button className="avatar" onClick={() => setAccount(true)} aria-label="Account and settings">
                {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : session ? (name[0] || '?').toUpperCase() : 'EL'}
              </button>
            </div>
          </div>
          <div key={tab} className="tabview">
              {tab === 'today' && <Today nav={nav} />}
              {tab === 'practice' && <Practice nav={nav} />}
              {tab === 'verbs' && <Verbs nav={nav} />}
              {tab === 'progress' && <Progress nav={nav} />}
          </div>
        </motion.main>
      )}
      {authReady && (session || devGuest) && <TabBar tab={tab} onTab={go} />}

      <Sheet open={!!verb} onClose={() => setVerb(null)} label="Verb">
        {verb && <VerbDetail id={verb} onPractice={(id) => nav.start([verbItem(VERB_BY_ID[id], 'forms', items, settings)], id)} />}
      </Sheet>

      <AnimatePresence>
        {run && <Session key={run.id} items={run.items} title={run.title} grow={run.grow} onClose={() => setRun(null)} />}
        {sprint && <Sprint key="sprint" onClose={() => setSprint(false)} />}
        {xw && <Crossword key="xw" onClose={() => setXw(false)} />}
        {arena > 0 && <Arena key={arena} onClose={() => setArena(0)} />}
        {account && <ProfilePage key="profile" onClose={closeProfile} toast={toast} />}
      </AnimatePresence>
      <Toast msg={toastMsg} />
    </>
  )
}
