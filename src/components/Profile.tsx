import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, RefreshCw, Flame, Zap, Trophy, Pencil, Check, X, Target, Clock, BookOpen, Timer, CalendarDays, Layers, ChevronRight } from 'lucide-react'
import { useStore, updateProfile, setSettings, syncNow, getState } from '../lib/store'
const getItems = () => getState().items
import { VERBS } from '../lib/verbs'
import { maturity } from '../lib/fsrs'
import { levelOf, rating } from '../lib/adaptive'
import { fetchLeague, fetchWeeks, buildStats, pushLeague, weekXp, todayXp, weekDays, weekEndsIn, defaultName, type Row, type PubStats } from '../lib/league'
import { SignIn, SettingsSections } from './Account'

const DAY_LBL = ['P', 'T', 'S', 'Č', 'P', 'S', 'N']
const HUES = [252, 160, 20, 200, 330, 40, 280, 120]
const hueOf = (id: string) => HUES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]

function endsLabel(ms: number) {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (d >= 2) return `še ${d} dni`
  if (d === 1) return `še 1 dan in ${h} h`
  return `še ${Math.max(1, h)} h`
}

function Avatar({ id, name, img, size = 40 }: { id: string; name: string; img?: string; size?: number }) {
  const h = hueOf(id)
  return (
    <span className="pav" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 85% 94%)`, color: `hsl(${h} 60% 40%)`, borderColor: `hsl(${h} 70% 86%)` }}>
      {img ? <img src={img} alt="" referrerPolicy="no-referrer" /> : (name[0] || '?').toUpperCase()}
    </span>
  )
}

function NameEditor() {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  const name = defaultName()
  if (!edit) return (
    <button className="pname" onClick={() => { setV(name); setEdit(true) }} aria-label="Uredi ime na lestvici">
      <span>{name}</span><Pencil />
    </button>
  )
  const save = () => {
    const n = v.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (n) { updateProfile((p) => ({ ...p, name: n })); void pushLeague() }
    setEdit(false)
  }
  return (
    <form className="pname-edit" onSubmit={(e) => { e.preventDefault(); save() }}>
      <input className="field" value={v} maxLength={24} autoFocus onChange={(e) => setV(e.target.value)} aria-label="Ime na lestvici" />
      <button className="btn primary sm" aria-label="Shrani ime"><Check /></button>
    </form>
  )
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)
const fmtSince = (k: string | null | undefined) => {
  if (!k) return null
  const [y, mo, d] = k.split('-').map(Number)
  return `${d}. ${mo}. ${y}`
}

/** Profil člana lestvice: tedenski XP, raven, glagoli, natančnost, čas, nizi in zgodovina tednov. */
function MemberSheet({ row, rank, mine, me, onClose }: { row: Row; rank: number; mine: boolean; me?: { xp: number; known: number }; onClose: () => void }) {
  const session = useStore((s) => s.session)
  const st: Partial<PubStats> = mine ? buildStats() : row.stats || {}
  const has = st.total !== undefined
  const [weeks, setWeeks] = useState<{ week: string; xp: number }[] | null>(null)
  useEffect(() => {
    let live = true
    void fetchWeeks(row.user_id).then((w) => { if (live) setWeeks(w) })
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => { live = false; window.removeEventListener('keydown', h) }
  }, [row.user_id, onClose])
  const days = st.days && st.days.length === 7 ? st.days : null
  const todayIdx = (new Date().getDay() + 6) % 7
  const dmax = Math.max(20, ...(days || [0]))
  const wmax = Math.max(50, ...(weeks || []).map((w) => w.xp))
  const acc = st.total ? Math.round(((st.correct || 0) / st.total) * 100) : null
  const tiles: { icon: React.ReactNode; v: string; l: string; c?: string }[] = has ? [
    { icon: <BookOpen />, v: `${st.known ?? row.known}/${VERBS.length}`, l: 'glagolov zna', c: 'mint' },
    { icon: <Target />, v: st.acc14 != null ? `${st.acc14} %` : acc != null ? `${acc} %` : '–', l: st.acc14 != null ? 'natančnost, 14 dni' : 'natančnost' },
    { icon: <Layers />, v: String(st.total), l: 'odgovorov skupaj' },
    { icon: <Clock />, v: fmtMin(st.min || 0), l: 'časa vadbe' },
    { icon: <Flame />, v: `${row.streak} / ${st.best || row.streak}`, l: 'niz zdaj / najdaljši', c: 'amber' },
    { icon: <CalendarDays />, v: `${st.active30 || 0}/30`, l: 'aktivnih dni' },
    { icon: <Timer />, v: String(st.sprint || 0), l: 'rekord hitri krog' },
    { icon: <Check />, v: String(st.cards || 0), l: 'utrjenih kartic s testa' },
  ] : []
  return (
    <>
      <motion.div className="msheet-back" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="msheet" role="dialog" aria-modal="true" aria-label={`Profil: ${row.name}`}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose() }}>
        <div className="msheet-grab" />
        <button className="iconbtn msheet-x" onClick={onClose} aria-label="Zapri"><X /></button>
        <div className="mhero">
          <Avatar id={row.user_id} name={row.name} size={72} img={mine ? session?.user.user_metadata?.avatar_url : undefined} />
          <div className="mname">{row.name}{mine && <em> (ti)</em>}</div>
          <div className="mtags">
            {rank > 0 && <span className={'mtag rank' + (rank <= 3 ? ' r' + rank : '')}><Trophy />{rank}. mesto</span>}
            {st.lvl && <span className="mtag lvl">Raven {st.lvl} · {st.rt}</span>}
            {fmtSince(st.since) && <span className="mtag">vadi od {fmtSince(st.since)}</span>}
          </div>
        </div>

        <div className="pstats" style={{ marginTop: 14 }}>
          <div className="pst violet"><Zap /><b className="num">{row.xp}</b><span>XP ta teden</span></div>
          <div className="pst amber"><Flame /><b className="num">{row.streak}</b><span>dni zapored</span></div>
        </div>

        {days && (
          <div className="card mcard">
            <div className="card-head"><span className="h3">Ta teden</span><span className="small muted">XP po dnevih</span></div>
            <div className="wk">
              {days.map((x, i) => (
                <div key={i} className={'wk-col' + (i === todayIdx ? ' today' : '') + (i > todayIdx ? ' future' : '')}>
                  <div className="wk-bar"><i style={{ height: `${Math.max(x ? 8 : 0, (x / dmax) * 100)}%`, animationDelay: `${i * 40}ms` }} /></div>
                  <span>{DAY_LBL[i]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {has ? (
          <div className="mgrid">
            {tiles.map((t, i) => (
              <motion.div key={t.l} className={'mtile' + (t.c ? ' ' + t.c : '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
                {t.icon}<b className="num">{t.v}</b><span>{t.l}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>Podrobna statistika se pokaže, ko {row.name} naslednjič vadi.</div>
        )}

        {weeks && weeks.length > 1 && (
          <div className="card mcard">
            <div className="card-head"><span className="h3">Zadnji tedni</span><span className="small muted">skupaj {weeks.reduce((a, w) => a + w.xp, 0)} XP</span></div>
            <div className="wk">
              {weeks.map((w, i) => (
                <div key={w.week} className={'wk-col' + (i === weeks.length - 1 ? ' today' : '')}>
                  <div className="wk-bar"><i style={{ height: `${Math.max(w.xp ? 8 : 0, (w.xp / wmax) * 100)}%`, animationDelay: `${i * 40}ms` }} /></div>
                  <span>T{Number(w.week.slice(-2))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!mine && me && (
          <div className="card mcard vs">
            <div className="h3" style={{ marginBottom: 10 }}>Ti proti {row.name}</div>
            {[['XP ta teden', me.xp, row.xp], ['Glagolov znaš', me.known, st.known ?? row.known]].map(([l, a, b]) => {
              const A = Number(a), B = Number(b), tot = Math.max(1, A + B)
              return (
                <div key={String(l)} className="vs-row">
                  <div className="vs-top"><b className="num">{A}</b><span>{l}</span><b className="num">{B}</b></div>
                  <div className="vs-bar"><i className="you" style={{ width: `${(A / tot) * 100}%` }} /><i className="them" style={{ width: `${(B / tot) * 100}%` }} /></div>
                </div>
              )
            })}
            <p className="small muted" style={{ margin: '10px 0 0' }}>{me.xp >= row.xp ? 'Ta teden si pred njim, kar tako naprej.' : `Do prehiteva ti manjka ${row.xp - me.xp + 1} XP, to je približno ${Math.ceil((row.xp - me.xp + 1) / 10)} pravilnih novih nalog.`}</p>
          </div>
        )}
      </motion.div>
    </>
  )
}

function League() {
  const session = useStore((s) => s.session)
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const myXp = weekXp(profile)

  useEffect(() => {
    if (!session) return
    let live = true
    void (async () => {
      await pushLeague()
      const r = await fetchLeague()
      if (!live) return
      if (r) setRows(r); else setErr(true)
    })()
    return () => { live = false }
  }, [session, settings.league, profile.name])

  if (!session) return (
    <div className="card">
      <div className="h3" style={{ marginBottom: 6 }}>Tekmuj z ostalimi</div>
      <p className="muted small" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>Prijavi se, da se tvoj napredek shrani v oblak in da se tvoj tedenski XP pokaže na lestvici med ostalimi.</p>
      <SignIn compact />
    </div>
  )

  const me = session.user.id
  const list = rows ? rows.filter((r) => settings.league || r.user_id !== me) : []
  const myRank = list.findIndex((r) => r.user_id === me) + 1

  return (
    <div className="card league">
      <div className="league-head">
        <div>
          <div className="h3">Tedenska lestvica</div>
          <div className="small muted">{endsLabel(weekEndsIn())} do konca tedna</div>
        </div>
        {settings.league && myRank > 0 && <div className="myrank"><Trophy /><b>{myRank}.</b></div>}
      </div>
      {err && <div className="empty">Lestvice ni bilo mogoče naložiti. Poskusi znova pozneje.</div>}
      {!rows && !err && <div className="lb-skel">{[0, 1, 2].map((i) => <i key={i} />)}</div>}
      {rows && list.length === 0 && <div className="empty">Ta teden še nihče nima XP. Bodi prvi.</div>}
      <ol className="lb">
        {list.map((r, i) => {
          const mine = r.user_id === me
          return (
            <motion.li key={r.user_id} className={'lb-row' + (mine ? ' me' : '') + (i < 3 ? ' top' + (i + 1) : '')} role="button" tabIndex={0}
              onClick={() => setOpen(r.user_id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(r.user_id) } }} aria-label={`Odpri profil: ${r.name}`}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32, delay: Math.min(i, 12) * 0.035 }}>
              <span className="lb-pos">{i + 1}</span>
              <Avatar id={r.user_id} name={r.name} size={36} img={mine ? session.user.user_metadata?.avatar_url : undefined} />
              <span className="lb-name">{mine ? (profile.name || r.name) : r.name}{mine && <em> (ti)</em>}<small>{r.known} glagolov{r.streak ? `, ${r.streak} dni zapored` : ''}</small></span>
              <b className="lb-xp num">{mine ? myXp : r.xp} XP</b>
              <ChevronRight className="lb-chev" />
            </motion.li>
          )
        })}
      </ol>
      <AnimatePresence>
        {open && (() => {
          const idx = list.findIndex((r) => r.user_id === open)
          const r = list[idx]
          if (!r) return null
          const mine = r.user_id === me
          const meRow = list.find((x) => x.user_id === me)
          return <MemberSheet key={open} row={mine ? { ...r, name: profile.name || r.name, xp: myXp } : r} rank={idx + 1} mine={mine}
            me={{ xp: myXp, known: meRow?.known ?? VERBS.filter((v) => maturity(getItems()['v:' + v.id]) === 'mature').length }} onClose={() => setOpen(null)} />
        })()}
      </AnimatePresence>
      <div className="set" style={{ padding: '12px 0 0' }}>
        <div className="set-l">Prikaži me na lestvici<small>Vidijo te samo prijavljeni: ime, XP in statistika, nikoli e-pošta</small></div>
        <input type="checkbox" className="switch" checked={settings.league} onChange={(e) => setSettings({ league: e.target.checked })} aria-label="Prikaži me na lestvici" />
      </div>
    </div>
  )
}

export function ProfilePage({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const session = useStore((s) => s.session)
  const sync = useStore((s) => s.sync)
  const profile = useStore((s) => s.profile)
  const items = useStore((s) => s.items)
  const known = useMemo(() => VERBS.filter((v) => maturity(items['v:' + v.id]) === 'mature').length, [items])
  const days = weekDays()
  const xs = days.map((d) => profile.days[d]?.x || 0)
  const max = Math.max(20, ...xs)
  const todayIdx = (new Date().getDay() + 6) % 7
  const name = session ? defaultName() : 'Gost'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h) }
  }, [onClose])

  return (
    <motion.div className="page" role="dialog" aria-modal="true" aria-label="Profil"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
      <div className="page-inner">
        <div className="page-top">
          <button className="iconbtn back" onClick={onClose} aria-label="Nazaj"><ChevronLeft /></button>
          <span className="h3">Profil</span>
          {session ? <button className={'iconbtn' + (sync === 'syncing' ? ' spin' : '')} onClick={() => syncNow()} aria-label="Sinhroniziraj"><RefreshCw /></button> : <span style={{ width: 40 }} />}
        </div>

        <div className="phero">
          <Avatar id={session?.user.id || 'guest'} name={name} img={session?.user.user_metadata?.avatar_url} size={76} />
          {session ? <NameEditor /> : <div className="pname"><span>Gost</span></div>}
          <div className="small muted">{session ? (sync === 'synced' ? 'Napredek je shranjen v oblaku' : sync === 'syncing' ? 'Shranjujem …' : sync === 'offline' ? 'Brez povezave, shranim pozneje' : 'Shranjevanje ni uspelo') : 'Napredek je samo v tem brskalniku'}</div>
        </div>

        <div className="pstats">
          <div className="pst amber"><Flame /><b className="num">{profile.streak || 0}</b><span>dni zapored</span></div>
          <div className="pst violet"><Zap /><b className="num">{weekXp(profile)}</b><span>XP ta teden</span></div>
          <div className="pst mint"><b className="num big2">{known}</b><span>glagolov znaš</span></div>
          <div className="pst"><b className="num big2">{levelOf(profile.theta)}</b><span>raven, {rating(profile.theta)}</span></div>
        </div>

        <div className="card">
          <div className="card-head"><span className="h3">Ta teden</span><span className="small muted">danes {todayXp(profile)} XP</span></div>
          <div className="wk">
            {xs.map((x, i) => (
              <div key={i} className={'wk-col' + (i === todayIdx ? ' today' : '') + (i > todayIdx ? ' future' : '')}>
                <div className="wk-bar"><i style={{ height: `${Math.max(x ? 8 : 0, (x / max) * 100)}%`, animationDelay: `${i * 40}ms` }} /></div>
                <span>{DAY_LBL[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <League />
        <SettingsSections toast={toast} />
      </div>
    </motion.div>
  )
}
