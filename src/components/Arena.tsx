// Live arena (like Kahoot, just for English): 10 s lobby, 8 questions of 12 s each, points for accuracy and speed.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Trophy, Users, Zap, RotateCcw, Check, Volume2, Send } from 'lucide-react'
import { supabase, type RealtimeChannel } from '../lib/supabase'
import { getState, updateProfile } from '../lib/store'
import { defaultName, scheduleLeaguePush } from '../lib/league'
import { today, dayOffset } from '../lib/content'
import { speakVerb, fadeOut } from '../lib/speech'
import { sfx } from '../lib/sound'
import {
  syncClock, now, nextSlot, roomQuestions, points, fillBots, botAnswer, arenaAdjust, rememberPlace, fetchJevRoom, timeline, type JevRoom,
  LOBBY_MS, N_Q, ROOM_SIZE, type Player,
} from '../lib/arena'
import { checkForm, checkText } from '../lib/check'
import { PicImg } from './Pics'
import { Kinetic } from './Kinetic'

const HUES = [252, 160, 20, 200, 330, 40, 280, 120]
const hueOf = (id: string) => HUES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
function Av({ p, size = 40 }: { p: Player; size?: number }) {
  const h = hueOf(p.id)
  return <span className="pav" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 85% 94%)`, color: `hsl(${h} 60% 40%)`, borderColor: `hsl(${h} 70% 86%)` }}>{(p.name[0] || '?').toUpperCase()}</span>
}
const XP_FOR = [40, 30, 22, 16, 12, 10]
const SHAPES = ['▲', '◆', '●', '■']

function addXp(xp: number) {
  const td = today()
  updateProfile((p) => {
    const np = { ...p, days: { ...p.days } }
    if (np.lastDay !== td) {
      np.streak = np.lastDay === dayOffset(-1) ? (np.streak || 0) + 1 : 1
      np.lastDay = td
      np.best = Math.max(np.best || 0, np.streak)
    }
    const d = { ...(np.days[td] || { n: 0, c: 0, t: 0 }) }
    d.x = (d.x || 0) + xp
    np.days[td] = d
    return np
  })
  scheduleLeaguePush(1000)
}

type Ans = { c: number; ms: number }

export function Arena({ onClose }: { onClose: () => void }) {
  const st = getState()
  const me = useMemo<Player>(() => ({ id: st.session?.user.id || 'guest-' + Math.random().toString(36).slice(2, 8), name: st.session ? defaultName() : 'Guest', theta: st.profile.theta || 0 }), [st.session, st.profile.theta])
  const [room, setRoom] = useState<{ slot: number; start: number } | null>(null)
  const [humans, setHumans] = useState<Player[]>([me])
  const [roster, setRoster] = useState<Player[] | null>(null)
  const [jvFrozen, setJvFrozen] = useState<JevRoom | null>(null)
  const [answers, setAnswers] = useState<Record<string, Ans>>({})
  const [t, setT] = useState(now())
  const [online, setOnline] = useState(true)
  const ch = useRef<RealtimeChannel | null>(null)
  const adjust = useMemo(() => arenaAdjust(), [])
  const awarded = useRef(false)
  const spoken = useRef(-1)

  // join the room
  useEffect(() => {
    let alive = true
    void (async () => {
      await syncClock()
      if (!alive) return
      const r = nextSlot()
      setRoom(r)
      const c = supabase.channel(`arena-${r.slot}`, { config: { presence: { key: me.id }, broadcast: { self: false } } })
      c.on('presence', { event: 'sync' }, () => {
        const ps = c.presenceState<{ name: string; theta: number }>()
        const list: Player[] = Object.entries(ps).map(([id, v]) => ({ id, name: v[0]?.name || 'Player', theta: Number(v[0]?.theta) || 0 }))
        if (!list.some((p) => p.id === me.id)) list.push(me)
        setHumans(list.sort((a, b) => a.id.localeCompare(b.id)))
      })
      c.on('broadcast', { event: 'ans' }, ({ payload }) => {
        const p = payload as { u: string; i: number; c: number; ms: number }
        if (typeof p?.i !== 'number' || typeof p.c !== 'number') return
        setAnswers((a) => (a[`${p.u}|${p.i}`] ? a : { ...a, [`${p.u}|${p.i}`]: { c: p.c, ms: Math.max(0, Math.min(30_000, p.ms)) } }))
      })
      c.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await c.track({ name: me.name, theta: me.theta })
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setOnline(false)
      })
      ch.current = c
    })()
    const iv = window.setInterval(() => setT(now()), 100)
    return () => { alive = false; window.clearInterval(iv); fadeOut(); if (ch.current) void supabase.removeChannel(ch.current) }
  }, [me])

  const qs = useMemo(() => (room ? roomQuestions(room.slot) : []), [room])
  // For each question Jev rates the difficulty and tempting wrong answers; the same for all devices in the room
  const [jv, setJv] = useState<JevRoom | null>(null)
  useEffect(() => { if (room && qs.length) void fetchJevRoom(room.slot, qs).then(setJv) }, [room, qs])
  const start = room?.start ?? Infinity
  const freezeAt = start - 600

  // freeze the line up just before the start: people + bots until the room is full
  useEffect(() => {
    if (!room || roster || t < freezeAt) return
    const hs = humans.length ? humans : [me]
    setRoster([...hs, ...fillBots(room.slot, hs, adjust)])
    setJvFrozen(jv) // Jev's decisions are frozen at the start so the opponents do not change during the game
  }, [t, room, roster, humans, me, adjust, freezeAt, jv])

  const players = roster || [...humans, ...(room ? fillBots(room.slot, humans, adjust) : [])]
  const botCache = useRef(new Map<string, Ans>())
  const ansOf = (p: Player, i: number): Ans | null => {
    if (p.bot && room) {
      const key = `${p.id}|${i}`
      let a = botCache.current.get(key)
      if (!a) { const b = botAnswer(room.slot, p, i, qs[i], jvFrozen); a = { c: b.choice, ms: b.ms }; if (roster) botCache.current.set(key, a) }
      return a
    }
    return answers[`${p.id}|${i}`] || null
  }
  // timeline: each player has their own time per question; when everyone has answered we move on at once (the same on all devices)
  const slots = useMemo(() => {
    if (!room || !roster) return null
    return timeline(start, qs, (i) => {
      let mx = 0
      for (const p of roster) { const a = ansOf(p, i); if (!a) return null; mx = Math.max(mx, a.ms) }
      return mx
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roster, qs, answers, jvFrozen, start])
  let k = -1
  let phase: 'wait' | 'lobby' | 'q' | 'reveal' | 'end' = !room ? 'wait' : t < start || !slots ? 'lobby' : 'end'
  if (slots && t >= start) {
    const idx = slots.findIndex((x) => t < x.revEnd)
    if (idx >= 0) { k = idx; phase = t < slots[idx].end ? 'q' : 'reveal' }
    else k = N_Q
  }
  const cur = k >= 0 && k < N_Q && slots ? slots[k] : null
  const within = cur ? t - cur.start : 0

  // points: only for questions already revealed
  const revealedUpTo = phase === 'end' ? N_Q - 1 : phase === 'reveal' ? k : k - 1
  const scores = useMemo(() => {
    const out = new Map<string, { score: number; last: number; correct: number; streak: number }>()
    for (const p of players) {
      let score = 0, streak = 0, correct = 0, last = 0
      for (let i = 0; i <= revealedUpTo && i < qs.length; i++) {
        const a = ansOf(p, i)
        const ok = !!a && a.c === qs[i].correct
        streak = ok ? streak + 1 : 0
        last = a ? points(ok, a.ms, streak, qs[i].limit) : 0
        score += last
        if (ok) correct++
      }
      out.set(p.id, { score, last, correct, streak })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map((p) => p.id).join(), revealedUpTo, answers, qs, jvFrozen, roster])
  const ranked = [...players].sort((a, b) => (scores.get(b.id)?.score || 0) - (scores.get(a.id)?.score || 0))
  const myPlace = ranked.findIndex((p) => p.id === me.id) + 1

  // sound on reveal and pronunciation of the verb
  useEffect(() => {
    if (phase !== 'reveal' || spoken.current === k) return
    spoken.current = k
    const mine = answers[`${me.id}|${k}`]
    if (mine) { if (mine.c === qs[k].correct) sfx.ok(scores.get(me.id)?.streak || 0); else sfx.bad() }
    if (qs[k]?.vid && qs[k].kind !== 'listen' && getState().settings.speech) speakVerb(qs[k].vid!, qs[k].vid!)
  }, [phase, k, answers, me.id, qs, scores])
  // listening: the verb plays right when the question starts
  const played = useRef(-1)
  useEffect(() => {
    if (phase !== 'q' || played.current === k || qs[k]?.kind !== 'listen') return
    played.current = k
    window.setTimeout(() => speakVerb(qs[k].vid!, qs[k].vid!), 250)
  }, [phase, k, qs])

  // reward at the end
  useEffect(() => {
    if (phase !== 'end' || awarded.current || !roster) return
    awarded.current = true
    const xp = (XP_FOR[myPlace - 1] || 8) + 3 * (scores.get(me.id)?.correct || 0)
    addXp(xp)
    rememberPlace(myPlace)
    if (myPlace === 1) sfx.ok(5)
  }, [phase, myPlace, roster, scores, me.id])

  const [typed, setTyped] = useState('')
  useEffect(() => { setTyped('') }, [k])
  const submitTyped = () => {
    const q0 = qs[k]
    if (!q0 || q0.kind !== 'type' || !typed.trim()) return
    const ok = q0.verbInput ? checkForm(typed, new Set(q0.accept || [])).ok : checkText(typed, q0.accept || [])
    answer(ok ? 0 : 1)
  }
  const answer = (c: number) => {
    if (phase !== 'q' || answers[`${me.id}|${k}`]) return
    const ms = Math.round(within)
    setAnswers((a) => ({ ...a, [`${me.id}|${k}`]: { c, ms } }))
    sfx.tap()
    void ch.current?.send({ type: 'broadcast', event: 'ans', payload: { u: me.id, i: k, c, ms } })
  }

  const q = k >= 0 && k < N_Q ? qs[k] : null
  const myAns = q ? answers[`${me.id}|${k}`] : null
  const answeredN = q ? players.filter((p) => { const a = ansOf(p, k); return a && (p.bot ? a.ms <= within : true) }).length : 0
  const timeLeft = cur && phase === 'q' ? Math.max(0, Math.ceil((cur.end - t) / 1000)) : 0
  // distribution of answers across the options (like Kahoot after each question)
  const dist = q && phase === 'reveal' ? q.options.map((_, i) => players.filter((p) => ansOf(p, k)?.c === i).length) : []
  const lobbyLeft = Math.max(0, Math.ceil((start - t) / 1000))
  const lobbyFrac = room ? Math.max(0, Math.min(1, 1 - (start - t) / LOBBY_MS)) : 0
  const visible = players.filter((p) => !p.bot || lobbyFrac >= (p.joinAt || 0) || roster)
  const xpWon = (XP_FOR[myPlace - 1] || 8) + 3 * (scores.get(me.id)?.correct || 0)

  return (
    <motion.div className="session arena" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="s-inner">
        <div className="s-top">
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X /></button>
          {(phase === 'q' || phase === 'reveal') && q && <div className={'track' + (phase === 'q' && timeLeft <= 3 ? ' urgent' : '')}><i style={{ width: `${phase === 'q' && cur ? Math.max(0, 1 - within / q.limit) * 100 : 0}%`, transition: 'width .1s linear' }} /></div>}
          {(phase === 'q' || phase === 'reveal') && <div className="combo">{phase === 'q' ? `${timeLeft} s` : `${k + 1}/${N_Q}`}</div>}
        </div>

        {(phase === 'wait' || phase === 'lobby') && (
          <motion.div className="qcard glass a-lobby" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="qmeta"><span className="k live"><i />Live</span><span><Users size={14} /> {visible.length}/{ROOM_SIZE}</span></div>
            <div className="a-count num">{phase === 'wait' ? '…' : lobbyLeft}</div>
            <div className="a-sub">{phase === 'wait' ? 'Connecting …' : visible.length < ROOM_SIZE ? 'Looking for players …' : 'The room is full, starting'}</div>
            <div className="a-players">
              <AnimatePresence>
                {visible.map((p) => (
                  <motion.div key={p.id} className={'a-pl' + (p.id === me.id ? ' me' : '')} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
                    <Av p={p} size={46} /><span>{p.id === me.id ? 'You' : p.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <p className="tiny muted" style={{ textAlign: 'center', margin: '16px 0 0' }}>8 questions of six types. Longer tasks get more time, and once everyone has answered we move on. The faster you answer correctly, the more points you get.{!online && ' The live connection failed, you are playing against the opponents in the room.'}</p>
          </motion.div>
        )}

        {q && (phase === 'q' || phase === 'reveal') && (
          <AnimatePresence mode="wait">
            <motion.div key={k} className="qcard glass a-q" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              <div className="qmeta"><span className="k live"><i />{q.label}</span><span>{answeredN}/{players.length} answered</span></div>
              {q.kind === 'listen' && (
                <div className="dict-btns" style={{ marginTop: 14 }}>
                  <button className="dict-play" onClick={() => speakVerb(q.vid!, q.vid!)} aria-label="Play again"><Volume2 /></button>
                </div>
              )}
              {q.img ? <div className="pic-stage"><PicImg id={q.img} size={150} /></div>
                : <div className={'qword' + (q.kind === 'translate' ? '' : q.q.length > 40 ? ' long' : '')} lang={q.kind === 'translate' ? 'sl' : 'en'}>{q.q}</div>}
              {q.sub && <div className="qhint" lang="en">{q.sub}</div>}
              {q.kind === 'type' ? (
                <div className="a-type">
                  {phase === 'q' && !myAns ? (
                    <>
                      <Kinetic value={typed} onChange={setTyped} onEnter={submitTyped} status="idle" correct={q.options[0]} enterKeyHint="go" ariaLabel="Answer" />
                      <button className="btn primary" onClick={submitTyped} disabled={!typed.trim()}><Send />Submit</button>
                    </>
                  ) : (
                    <div className={'a-typed' + (phase === 'reveal' ? (myAns?.c === 0 ? ' ok' : ' bad') : '')} lang="en">
                      {phase === 'reveal' ? <>Correct: <b>{(q.accept || [q.options[0]]).slice(0, 3).join(' / ')}</b></> : 'Answer submitted'}
                    </div>
                  )}
                  {phase === 'reveal' && <div className="a-dist-line">{players.filter((p) => ansOf(p, k)?.c === 0).length} od {players.length} correct</div>}
                </div>
              ) : (
                <div className={'a-opts' + (q.options.length === 2 ? ' two' : '')}>
                  {q.options.map((o, i) => {
                    const picked = myAns?.c === i
                    const cls = phase === 'reveal' ? (i === q.correct ? ' ok' : picked ? ' bad' : ' dim') : myAns ? (picked ? ' picked' : ' dim') : ''
                    return (
                      <motion.button key={i} className={'aopt c' + i + cls} onClick={() => answer(i)} disabled={phase !== 'q' || !!myAns}
                        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 * i, type: 'spring', stiffness: 500, damping: 30 }}>
                        <span className="shape">{phase === 'reveal' && i === q.correct ? <Check size={18} /> : SHAPES[i]}{phase === 'reveal' && <em className="cnt">{dist[i]}</em>}</span><span lang="en">{o}</span>
                        {phase === 'reveal' && <i className="bar" style={{ width: `${(dist[i] / Math.max(1, players.length)) * 100}%` }} />}
                      </motion.button>
                    )
                  })}
                </div>
              )}
              {phase === 'q' && myAns && <div className="a-wait">Answer submitted. Waiting for the others …</div>}
              {phase === 'reveal' && (
                <motion.div className="a-reveal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={'a-gain' + (myAns && myAns.c === q.correct ? ' ok' : ' bad')}>
                    {myAns ? (myAns.c === q.correct ? `+${scores.get(me.id)?.last || 0}` : 'Wrong') : 'No answer'}
                    {(scores.get(me.id)?.streak || 0) >= 2 && <small><Zap size={13} /> streak {scores.get(me.id)?.streak}</small>}
                  </div>
                  <ol className="a-rank">
                    {ranked.slice(0, ROOM_SIZE).map((p, i) => (
                      <motion.li layout key={p.id} className={p.id === me.id ? 'me' : ''} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                        <b>{i + 1}</b><Av p={p} size={28} /><span>{p.id === me.id ? 'You' : p.name}</span><em className="num">{scores.get(p.id)?.score || 0}</em>
                      </motion.li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {phase === 'end' && (
          <motion.div className="qcard glass a-end" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="qmeta"><span className="k place">Game over</span><span>{myPlace}. place</span></div>
            <div className="podium">
              {[1, 0, 2].map((idx) => ranked[idx] && (
                <motion.div key={ranked[idx].id} className={'pod p' + (idx + 1) + (ranked[idx].id === me.id ? ' me' : '')} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + (2 - idx) * 0.2, type: 'spring', stiffness: 300, damping: 24 }}>
                  <Av p={ranked[idx]} size={idx === 0 ? 56 : 46} />
                  <span>{ranked[idx].id === me.id ? 'You' : ranked[idx].name}</span>
                  <em className="num">{scores.get(ranked[idx].id)?.score || 0}</em>
                  <div className="step">{idx === 0 ? <Trophy /> : idx + 1}</div>
                </motion.div>
              ))}
            </div>
            <ol className="a-rank" style={{ marginTop: 14 }}>
              {ranked.slice(3).map((p, i) => (
                <li key={p.id} className={p.id === me.id ? 'me' : ''}><b>{i + 4}</b><Av p={p} size={28} /><span>{p.id === me.id ? 'You' : p.name}</span><em className="num">{scores.get(p.id)?.score || 0}</em></li>
              ))}
            </ol>
            <div className="a-xp"><Zap /> +{xpWon} XP · {scores.get(me.id)?.correct || 0}/{N_Q} correct</div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={onClose}>Finish</button>
              <button className="btn primary" onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('el:arena')), 350) }}><RotateCcw />New game</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
