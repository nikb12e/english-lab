import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Volume2, Lightbulb, ArrowRight, Check, RotateCcw, Play, Sparkles, Flame, LifeBuoy } from 'lucide-react'
import { cardB, challengeItem, liveItems, liveSecsFor, similarTo, today, dayOffset, DECK_BY_ID, itemFromKey, bOf, autoVerbItem, sentFor, effDiff, openVerbKeys, verbBatch, type QItem } from '../lib/content'
import { emptyState, review, reinforce, fmtDue, runOf, DAY, type Grade, type MemState } from '../lib/fsrs'
import { getState, putItem, updateProfile } from '../lib/store'
import { family, TYPE_TXT, VERB_BY_ID, type Form, type Verb } from '../lib/verbs'
import { checkForm, checkText, lev, norm } from '../lib/check'
import { speak, speakVerb, prefetchVerb, prepare, canSpeak, haptic, hush, fadeOut, gapText, correctSpoken } from '../lib/speech'
import { sfx } from '../lib/sound'
import { xpFor, scheduleLeaguePush } from '../lib/league'
import { updateAbility, fakeForm, rating, pickNewVerbs, setFlow, getFlow } from '../lib/adaptive'
import { Kinetic, type KinStatus } from './Kinetic'
import type { ChoiceCard, TypeCard } from '../data/types'

import { spring, Tag, gradeFor, useReadTask, TaskSay, type Entry, type Result, type Kind } from './qshared'
import { FixQ, PickQ, OddQ, ExplainQ, WriteQ, Why, Listen } from './Tasks'
import { BuildQ, DictateQ, MatchQ } from './Tasks2'
import { PicQ } from './Pics'
import { recordAnswer } from '../lib/weak'
import { diagnose, type Diag } from '../lib/ai'
import { RuleExplain, ruleFor, type RuleId } from './Explain'
import { VERBS } from '../lib/verbs'
import { maturity } from '../lib/fsrs'
let uidc = 0

function flash(kind: 'ok' | 'bad') {
  const el = document.documentElement
  el.dataset.flash = kind
  window.setTimeout(() => { if (el.dataset.flash === kind) delete el.dataset.flash }, 420)
}

export function Session({ items, title, onClose, grow = false }: { items: QItem[]; title: string; onClose: () => void; grow?: boolean }) {
  const mk = (item: QItem, kind: Kind): Entry => ({ item, kind, uid: ++uidc, fresh: !getState().items[item.key]?.reps })
  const [queue, setQueue] = useState<Entry[]>(() => items.slice(1).map((it) => mk(it, 'first')))
  const [cur, setCur] = useState<Entry | null>(() => (items[0] ? mk(items[0], 'first') : null))
  const [done, setDone] = useState(0)
  const [combo, setCombo] = useState(0)
  const [burst, setBurst] = useState(0)
  const [finished, setFinished] = useState(!items.length)
  const stats = useRef({ first: new Map<string, boolean>(), missed: new Set<string>(), answered: 0, start: Date.now(), theta0: getState().profile.theta, best: 0, added: 0, xp: 0, placement: items.some((i) => i.kind === 'verb' && i.placement) })
  const snap = useRef<MemState | null>(null)
  // zadnjih nekaj odgovorov: iz njih se sproti prilagaja težavnost (če gre slabo, lažje naloge in nič novega)
  const flow = useRef<number[]>([])
  const challenges = useRef(0)
  // v vaji, kjer si sam izbral tip naloge, tipa ne menjamo; v mešanih sejah ga prilagaja tok
  const mixed = useRef(grow || new Set(items.flatMap((q) => (q.kind === 'verb' ? [q.task] : []))).size > 1 || items.some((q) => q.kind === 'card'))
  const lastChallenge = useRef(-10)
  const [flowNote, setFlowNote] = useState<null | 'up' | 'down'>(null)
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null)
  // animirana razlaga: uspešnost po vrsti nalog v tej seji in mejniki znanja
  const cats = useRef(new Map<string, { n: number; ok: number }>())
  const retries = useRef(new Map<string, number>())
  const similarN = useRef(0)
  const exam = title === 'Preverjanje'
  const shownRules = useRef(new Set<RuleId>())
  const missNotes = useRef<string[]>([])
  const pendingRule = useRef<{ rule: RuleId; pct?: number } | null>(null)
  const [rule, setRule] = useState<{ rule: RuleId; pct?: number } | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    setFlow(0)
    return () => { document.body.style.overflow = ''; hush(); setFlow(0) }
  }, [])

  // glas za naslednji dve nalogi se pripravi vnaprej, zato navodilo zazveni takoj, ko se naloga pokaže
  useEffect(() => {
    if (!getState().settings.speech) return
    for (const e of queue.slice(0, 3)) {
      const it = e.item
      if (it.kind === 'verb') {
        const v = it.verb
        if (it.task === 'context' || it.task === 'fix' || it.task === 'pick') {
          const [, form, text] = sentFor(e.uid, v.id)
          const g = gapText(text, it.task === 'fix' ? undefined : v.id)
          if (g) void prepare(g)
          void prepare(text.replace('___', v.shown[form][0]))
        } else if (it.task === 'si') void prepare(`${v.id}, ${v.third}, ${v.ing}`)
        else prefetchVerb(v.id)
      } else if (it.card.kind === 'type' || it.card.kind === 'choice') {
        const c = it.card
        const g = gapText(c.q)
        if (g) void prepare(g)
        const ok = correctSpoken(c.q, c.kind === 'type' ? c.a[0] : c.options[c.correct])
        if (ok) void prepare(ok)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.uid, queue[0]?.uid, queue[1]?.uid, queue[2]?.uid])

  // sproti: GPT-6 Luna med vajo ustvari nove naloge (najprej za tvoje šibke točke) in jih vrine v vrsto
  const [aiNote, setAiNote] = useState<null | 'gen' | number>(null)
  useEffect(() => {
    if (exam || stats.current.placement || items.length < 4) return
    const secs = liveSecsFor(items, getState().profile)
    if (!secs.length) return
    let alive = true
    setAiNote('gen')
    void Promise.all(secs.map((sec) => liveItems(sec, 2).catch(() => [] as QItem[]))).then((rs) => {
      if (!alive) return
      const got = rs.flat()
      if (!got.length) { setAiNote(null); return }
      setQueue((q) => {
        const nq = [...q]
        got.forEach((it, i) => nq.splice(Math.min(1 + i * 3, nq.length), 0, { item: it, kind: 'first', uid: ++uidc, fresh: true, ai: true }))
        return nq
      })
      setAiNote(got.length)
      window.setTimeout(() => { if (alive) setAiNote(null) }, 3200)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = useCallback((entry: Entry, r: Result, override = false) => {
    const { key } = entry.item
    const st = getState()
    const now = Date.now()
    let c: MemState = st.items[key] ? { ...st.items[key] } : emptyState()
    if (override && snap.current) c = { ...snap.current }
    else snap.current = { ...c }
    const wasNew = !c.reps
    const run0 = runOf(st.items[key])
    const wasDue = !!st.items[key]?.reps && st.items[key].due <= now
    const firstTime = !stats.current.first.has(key)
    const placement = entry.item.kind === 'verb' && !!entry.item.placement
    const grade: Grade = placement ? (r.ok ? 4 : 1) : r.grade
    c.seen += 1
    if (r.ok) c.correct += 1
    if (!r.ok && r.errFields?.length) {
      c.errs = { ...(c.errs || {}) }
      r.errFields.forEach((f) => (c.errs![f] = (c.errs![f] || 0) + 1))
    }
    c.hist = [...(c.hist || []), r.ok ? 1 : 0].slice(-12)
    const prevRun = runOf(c)
    if (firstTime || override) {
      c = { ...review(c, grade, now, st.settings.retention), errs: c.errs, hist: c.hist, seen: c.seen, correct: c.correct }
      // znanje: pravilno ob prvem srečanju (brez namiga) ali dvakrat zapored pravilno pomeni »znam«
      if (r.ok) c.run = (wasNew && grade >= 3) || placement ? 2 : (override ? Math.max(prevRun, 1) : prevRun + 1)
      else c.run = 0
      if ((c.run || 0) >= 2) {
        // znan glagol ne sme priti jutri znova: vsaj tri tedne do naslednje ponovitve
        c.S = Math.max(c.S, 21)
        c.due = Math.max(c.due, now + c.S * DAY)
      }
    }
    else if (r.ok) {
      c = reinforce(c, now, st.settings.retention)
      // popravek v isti seji: pravilno pri ponovitvi in nato še pri potrditvi (nekaj nalog kasneje) = dvakrat zapored, glagol je utrjen
      if (entry.kind === 'retry') c.run = Math.max(runOf(c), 1)
      else if (entry.kind === 'confirm') c.run = Math.max(runOf(c), 2)
    }
    else { c.u = now; if (!placement) c.run = 0 }
    putItem(key, c)
    const becameKnown = entry.item.kind === 'verb' && run0 < 2 && runOf(c) >= 2
    const xp = override ? 8 : xpFor({ ok: r.ok, placement, firstTime, wasDue, wasNew, becameKnown, kind: entry.kind })
    if (!override) flow.current = [...flow.current, r.ok ? 1 : 0].slice(-8)
    if (!placement && !override && firstTime) recordAnswer(entry.item, r.ok)
    if (!placement && !override && firstTime) {
      const it = entry.item
      const cat = it.kind === 'verb' ? 'v:' + it.task : (it.card.sec || it.deck.id)
      const cs = cats.current.get(cat) || { n: 0, ok: 0 }
      cs.n++; if (r.ok) cs.ok++
      cats.current.set(cat, cs)
      if (!r.ok && it.kind === 'card' && it.card.note) missNotes.current.push(it.card.note)
      const rl = ruleFor(cat)
      if (!exam && cs.n >= 3 && cs.ok / cs.n < 0.6 && !shownRules.current.has(rl) && !pendingRule.current) {
        shownRules.current.add(rl)
        pendingRule.current = { rule: rl }
      }
      if (becameKnown) {
        const known = VERBS.filter((v) => maturity(getState().items['v:' + v.id]) === 'mature').length
        const pctK = Math.floor((known / VERBS.length) * 100)
        let seen: number[] = []
        try { seen = JSON.parse(localStorage.getItem('el:ms') || '[]') } catch { /* */ }
        const hit = [25, 50, 75, 100].filter((m) => pctK >= m && !seen.includes(m)).pop()
        if (hit) {
          try { localStorage.setItem('el:ms', JSON.stringify([...seen, ...[25, 50, 75, 100].filter((m) => m <= hit)])) } catch { /* */ }
          pendingRule.current = { rule: 'milestone', pct: hit }
        }
      }
    }
    stats.current.xp += xp
    setGain((g) => ({ n: xp, k: (g?.k || 0) + 1 }))
    scheduleLeaguePush()

    const td = today()
    updateProfile((p) => {
      const np = { ...p, days: { ...p.days }, bAdj: { ...p.bAdj } }
      if (!override) {
        if (np.lastDay !== td) {
          np.streak = np.lastDay === dayOffset(-1) ? (np.streak || 0) + 1 : 1
          np.lastDay = td
          np.best = Math.max(np.best || 0, np.streak)
        }
        if (np.newDay !== td) { np.newDay = td; np.newVerbs = 0; np.newCards = 0 }
        if (wasNew && firstTime && !placement) {
          if (entry.item.kind === 'verb') np.newVerbs += 1
          else np.newCards += 1
        }
        const d = { ...(np.days[td] || { n: 0, c: 0, t: 0 }) }
        d.n += 1
        if (r.ok) d.c += 1
        d.t += Math.min(r.secs, 120)
        d.x = (d.x || 0) + xp
        np.days[td] = d
        np.total = (np.total || 0) + 1
        if (r.ok) np.correct = (np.correct || 0) + 1
        np.time = (np.time || 0) + Math.min(r.secs, 120)
        const ks = Object.keys(np.days).sort()
        while (ks.length > 365) delete np.days[ks.shift()!]
      } else {
        const d = np.days[td]
        if (d) np.days[td] = { ...d, c: d.c + 1, x: (d.x || 0) + xp }
        np.correct = (np.correct || 0) + 1
      }
      // sposobnost iz kartic s testa (težavnost oceni Jev): pol koraka, ker je kartic več vrst
      if (entry.item.kind === 'card' && firstTime && !override) {
        const cb = cardB(entry.item.card)
        if (cb != null) {
          const u = updateAbility(np.theta, cb, r.ok, np.thetaN)
          np.theta = Math.max(-3, Math.min(4, np.theta + (u.theta - np.theta) * 0.5))
        }
      }
      // sposobnost: samo prvi odgovor na glagol v seji
      if (entry.item.kind === 'verb' && entry.item.task !== 'si' && (firstTime || override)) {
        const id = entry.item.verb.id
        const b = bOf(p)(id)
        const u = updateAbility(np.theta, b, r.ok, np.thetaN)
        np.theta = Math.max(-3, Math.min(4, u.theta))
        np.bAdj[id] = Math.max(-1.5, Math.min(1.5, (np.bAdj[id] || 0) + (u.b - b)))
        if (!override) np.thetaN = (np.thetaN || 0) + 1
      }
      return np
    })

    if (!override) {
      stats.current.answered += 1
      if (firstTime) stats.current.first.set(key, r.ok)
    } else {
      if (entry.kind === 'first') stats.current.first.set(key, true)
      stats.current.missed.delete(key)
    }

    setQueue((q) => {
      let nq = q.filter((e) => !(e.item.key === key && e.kind !== 'first'))
      if (!r.ok && !placement) {
        stats.current.missed.add(key)
      }
      // po napaki pride še podobna naloga (druga kartica iste vrste ali glagol iste družine), da vzorec res utrdiš
      if (!r.ok && !placement && !exam && entry.kind !== 'similar' && similarN.current < 8) {
        const s3 = getState()
        const ex = new Set([key, ...nq.map((e) => e.item.key), ...stats.current.first.keys()])
        const sim = similarTo(entry.item, s3.items, s3.settings, ex)
        if (sim) { similarN.current++; nq = [...nq]; nq.splice(Math.min(1, nq.length), 0, { item: sim, kind: 'similar', uid: ++uidc, fresh: !s3.items[sim.key]?.reps }) }
      }
      // na preverjanju ni ponavljanja med testom; sicer se napaka vrne največ dvakrat
      const tries = (retries.current.get(key) || 0)
      if (!r.ok && !placement && !exam && tries < 2) {
        retries.current.set(key, tries + 1)
        nq = [...nq]
        nq.splice(Math.min(3, nq.length), 0, { item: { ...entry.item } as QItem, kind: 'retry', uid: ++uidc, fresh: false })
      } else if (r.ok && entry.kind === 'retry' && !exam) {
        nq = [...nq]
        nq.splice(Math.min(7, nq.length), 0, { item: { ...entry.item } as QItem, kind: 'confirm', uid: ++uidc, fresh: false })
      }
      // nova skupina glagolov pride šele, ko so vsi začeti glagoli utrjeni in v vrsti ni več novih
      // tok seje (»flow«): zadnjih 6 odgovorov odloči, ali naloge olajšamo ali otežimo
      const f = flow.current.slice(-6)
      const acc = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 1
      let trail = 0
      for (let k = flow.current.length - 1; k >= 0 && flow.current[k]; k--) trail++
      const prevFlow = getFlow()
      const nextFlow: -1 | 0 | 1 = placement || exam ? 0
        : f.length >= 4 && acc < 0.5 ? -1
        : f.length >= 5 && acc >= 0.84 && trail >= 4 ? 1
        : prevFlow === -1 && acc >= 0.67 ? 0
        : prevFlow === 1 && acc < 0.67 ? 0
        : prevFlow
      const struggling = nextFlow === -1
      if (nextFlow !== prevFlow && mixed.current) {
        setFlow(nextFlow)
        setFlowNote(nextFlow === 1 ? 'up' : nextFlow === -1 ? 'down' : null)
        if (nextFlow !== 0) window.setTimeout(() => setFlowNote(null), 3200)
        // prihodnje glagolske naloge (do 5) dobijo nov tip po novem toku
        const s2 = getState()
        let changed = 0
        nq = nq.map((e) => {
          if (changed >= 5 || e.kind !== 'first' || e.item.kind !== 'verb' || e.item.task === 'si' || e.item.placement) return e
          changed++
          return { ...e, item: autoVerbItem(e.item.verb, s2.items, s2.settings) }
        })
      }
      // ko ti gre odlično: občasno izziv, težka naloga s testa (največ 4 na sejo, vsaj 5 nalog narazen)
      if (nextFlow === 1 && !placement && !exam && r.ok && challenges.current < 4 && stats.current.answered - lastChallenge.current >= 5) {
        const s2 = getState()
        const ex = new Set([key, ...nq.map((e) => e.item.key), ...stats.current.first.keys()])
        const ch = challengeItem(s2.items, ex)
        if (ch) {
          challenges.current++
          lastChallenge.current = stats.current.answered
          nq = [...nq]
          nq.splice(Math.min(1, nq.length), 0, { item: ch, kind: 'first', uid: ++uidc, fresh: !s2.items[ch.key]?.reps, hard: true })
        }
      }
      if (grow && !struggling && !placement && !override && entry.item.kind === 'verb' && stats.current.added < 40) {
        const s2 = getState()
        const pendingNew = nq.some((e) => e.item.kind === 'verb' && !s2.items[e.item.key]?.reps)
        if (!pendingNew && openVerbKeys(s2.items).length === 0) {
          const taken = new Set([...nq.map((e) => e.item.key), key])
          const batch = pickNewVerbs(s2.profile.theta, s2.items, bOf(s2.profile), verbBatch(s2.settings) + 6, effDiff(s2.profile))
            .filter((v) => !taken.has('v:' + v.id)).slice(0, Math.min(verbBatch(s2.settings), 40 - stats.current.added))
          if (batch.length) {
            stats.current.added += batch.length
            nq = [...nq]
            batch.forEach((v, i) => nq.splice(Math.min(1 + i * 2, nq.length), 0, { item: autoVerbItem(v, s2.items, s2.settings), kind: 'first', uid: ++uidc, fresh: true }))
          }
        }
      }
      return nq
    })

    if (r.ok) {
      setCombo((n) => {
        const m = override ? n : n + 1
        stats.current.best = Math.max(stats.current.best, m)
        if (m > 0 && m % 5 === 0) sfx.combo(m)
        else sfx.ok(m)
        return m
      })
      setBurst((b) => b + 1)
      flash('ok')
    } else {
      setCombo(0)
      sfx.bad()
      flash('bad')
    }
    haptic(r.ok ? 'ok' : 'bad')
  }, [])

  const advance = useCallback(() => {
    fadeOut()
    if (pendingRule.current) { setRule(pendingRule.current); pendingRule.current = null; return }
    setDone((d) => d + 1)
    setQueue((q) => {
      if (!q.length) {
        setCur(null)
        setFinished(true)
        sfx.finish()
        return q
      }
      setCur(q[0])
      return q.slice(1)
    })
  }, [])

  useEffect(() => {
    if (finished && stats.current.placement) updateProfile((p) => ({ ...p, placed: true }))
  }, [finished])

  const remaining = queue.length + (cur ? 1 : 0)
  const pct = (done / Math.max(1, done + remaining)) * 100

  return (
    <motion.div className="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="s-inner">
        <div className="s-top">
          <button className="iconbtn" onClick={onClose} aria-label="Zapri vajo"><X /></button>
          {!finished && (
            <div className="track" aria-label={`Napredek ${Math.round(pct)} %`}>
              <motion.i animate={{ width: `${Math.max(2, pct)}%` }} transition={{ duration: 0.6, ease: 'easeOut' as const }} />
            </div>
          )}
          {!finished && (
            <motion.div key={combo} className={'combo' + (combo >= 5 ? ' hot' : '')} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' as const }} aria-label={`Zaporedje ${combo}`}>
              {combo >= 2 ? `×${combo}` : remaining}
            </motion.div>
          )}
          {!finished && gain && (
            <span key={gain.k} className="xp-pop" aria-hidden="true">+{gain.n}</span>
          )}
        </div>
        <AnimatePresence>
          {!finished && flowNote !== null && aiNote === null && (
            <motion.div className={'ai-note flow-' + flowNote} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              {flowNote === 'up' ? <><Flame />Gre ti odlično, prihajajo težje naloge</> : <><LifeBuoy />Malo lažje, da utrdiš osnove</>}
            </motion.div>
          )}
          {!finished && aiNote !== null && (
            <motion.div className={'ai-note' + (aiNote === 'gen' ? ' gen' : '')} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <Sparkles />{aiNote === 'gen' ? 'AI sproti pripravlja nove naloge zate' : `${aiNote} ${aiNote === 1 ? 'nova naloga' : aiNote === 2 ? 'novi nalogi' : aiNote <= 4 ? 'nove naloge' : 'novih nalog'} od AI v vrsti`}
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ position: 'relative' }}>
          <Burst n={burst} />
          <AnimatePresence mode="wait" initial={true}>
            {finished ? (
              <Summary key="sum" title={title} stats={stats.current} onClose={onClose} />
            ) : cur ? (
              <motion.div key={cur.uid}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                transition={spring}>
                {cur.item.kind === 'verb' ? (
                  cur.item.task === 'hunt' ? <HuntQ entry={cur} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                    : cur.item.task === 'fix' ? <FixQ entry={cur} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                    : cur.item.task === 'pick' ? <PickQ entry={cur} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                    : cur.item.task === 'odd' ? <OddQ entry={cur} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                    : cur.item.task === 'build' ? <BuildQ entry={cur} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                    : cur.item.task === 'dictate' ? <DictateQ entry={cur} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                    : cur.item.task === 'match' ? <MatchQ entry={cur} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                    : cur.item.task === 'context' ? <ContextQ entry={cur} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                      : <VerbQ entry={cur} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                ) : cur.item.card.kind === 'type' && cur.item.card.img ? (
                  <PicQ entry={cur} card={cur.item.card} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                ) : cur.item.card.kind === 'type' ? (
                  <TypeQ entry={cur} card={cur.item.card} onAnswer={(r) => apply(cur, r)} onOverride={(r) => apply(cur, r, true)} onNext={advance} />
                ) : cur.item.card.kind === 'write' ? (
                  <WriteQ entry={cur} card={cur.item.card} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                ) : cur.item.card.kind === 'explain' ? (
                  <ExplainQ entry={cur} card={cur.item.card} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                ) : (
                  <ChoiceQ entry={cur} card={cur.item.card} onAnswer={(r) => apply(cur, r)} onNext={advance} />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      {rule && <RuleExplain rule={rule.rule} pct={rule.pct} notes={missNotes.current} onDone={() => { setRule(null); advance() }} />}
    </motion.div>
  )
}

function Burst({ n }: { n: number }) {
  if (!n) return null
  return (
    <div className="burst" key={n} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3
        const d = 90 + Math.random() * 70
        return (
          <motion.i key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.7 + Math.random() * 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: i % 3 === 0 ? '#e3dcff' : i % 3 === 1 ? '#5cf2b4' : '#9db0ff' }} />
        )
      })}
    </div>
  )
}

const TASK_NAME: Record<string, string> = { forms: 'Tri oblike', inf: 'Iz infinitiva', reverse: 'Nazaj', si: '-s in -ing', listen: 'Narek', context: 'V stavku', hunt: 'Lov na napako', fix: 'Popravi napako', odd: 'Kateri ne spada', pick: 'Izberi obliko', build: 'Sestavi poved', dictate: 'Narek povedi', match: 'Poveži pare' }

function useTimer(active: boolean, seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds)
  const cb = useRef(onEnd)
  cb.current = onEnd
  useEffect(() => {
    if (!active) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - t0) / 1000)
      setLeft(l)
      if (l <= 0) { clearInterval(id); cb.current() }
    }, 100)
    return () => clearInterval(id)
  }, [active, seconds])
  return left
}
function TimerRing({ left, total }: { left: number; total: number }) {
  const C = 2 * Math.PI * 13
  return (
    <div className="timer" aria-label={`${Math.ceil(left)} s`}>
      <svg width="32" height="32"><circle cx="16" cy="16" r="13" stroke="rgba(120,120,128,.2)" strokeWidth="3" fill="none" />
        <circle cx="16" cy="16" r="13" stroke={left < 4 ? '#ff3b30' : '#007aff'} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} /></svg>
    </div>
  )
}

/* ───────────────────────── glagol: več polj ───────────────────────── */
function VerbQ({ entry, onAnswer, onOverride, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'verb' }>
  const v = item.verb
  const task = item.task
  const settings = getState().settings
  const brutal = false
  // pri nalogi »nazaj« dobiš eno obliko, napišeš ostali dve
  const given = useMemo<Form | null>(() => (task === 'reverse' ? (Math.random() < 0.6 ? 'pp' : 'past') : task === 'inf' ? 'inf' : null), [task])
  const heard = useMemo<Form>(() => (Math.random() < 0.5 ? 'past' : 'pp'), [])
  const fields: string[] = task === 'si' ? ['third', 'ing'] : (['inf', 'past', 'pp'] as const).filter((f) => f !== given)
  const labels: Record<string, string> = { inf: 'Infinitive', past: 'Past simple', pp: 'Past participle', third: 'He / she / it', ing: '-ing oblika' }
  const answerOf = (f: string): string[] => (f === 'third' ? [v.third] : f === 'ing' ? [v.ing] : v.shown[f as Form])
  const acceptOf = (f: string): Set<string> => (f === 'third' ? new Set([v.third]) : f === 'ing' ? new Set([v.ing]) : v.accept[f as Form])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [res, setRes] = useState<Record<string, boolean> | null>(null)
  const [over, setOver] = useState(false)
  const [hints, setHints] = useState(0)
  const t0 = useRef(Date.now())
  const refs = useRef<Record<string, HTMLInputElement | null>>({})
  const nextBtn = useRef<HTMLButtonElement>(null)
  const total = fields.length * 7 + 4
  const left = useTimer(brutal && !res, total, () => submit(false, true))

  useEffect(() => { if (task !== 'si') prefetchVerb(v.id); if (task === 'si') void prepare(`${v.id}, ${v.third}, ${v.ing}`) }, [v.id, task, v.third, v.ing])
  const say = (form?: Form) => form ? speak(v.shown[form][0]) : task === 'si' ? speak(`${v.id}, ${v.third}, ${v.ing}`) : speakVerb(v.id, [v.shown.inf[0], v.shown.past.join(' or '), v.shown.pp.join(' or ')].join(', '))
  useEffect(() => {
    const t = setTimeout(() => refs.current[fields[0]]?.focus({ preventScroll: true }), 120)
    if (task === 'listen') setTimeout(() => say(heard), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(gaveUp = false, timeout = false) {
    if (res) return
    if (!gaveUp && !timeout && fields.every((f) => !(vals[f] || '').trim())) return
    const r: Record<string, boolean> = {}
    fields.forEach((f) => (r[f] = !gaveUp && checkForm(vals[f] || '', acceptOf(f)).ok))
    const all = fields.every((f) => r[f])
    setRes(r)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok: all, grade: gradeFor(all, item.key, secs, fields.length, hints), errFields: fields.filter((f) => !r[f] && ['inf', 'past', 'pp'].includes(f)) as Form[], secs })
    // izgovorjava vedno, tudi po napaki: ravno takrat jo najbolj potrebuješ
    if (settings.speech) setTimeout(() => say(), all ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const hint = () => {
    if (res || brutal) return
    const h = hints + 1
    setHints(h)
    const nv = { ...vals }
    fields.forEach((f) => {
      const ans = answerOf(f)[0]
      const cur = norm(nv[f] || '')
      if (!cur || ans.startsWith(cur)) nv[f] = ans.slice(0, Math.min(ans.length - 1, h))
    })
    setVals(nv)
    const target = fields.find((f) => (nv[f] || '').length < answerOf(f)[0].length)
    if (target) setTimeout(() => refs.current[target]?.focus(), 10)
  }
  const enter = (i: number) => {
    if (res) return onNext()
    const nf = fields[i + 1]
    if (nf) { if ((vals[fields[i]] || '').trim()) refs.current[nf]?.focus() }
    else submit()
  }
  const allOk = res ? fields.every((f) => res[f]) : false
  const good = allOk || over
  const nearMiss = res && !allOk && fields.every((f) => res[f] || answerOf(f).some((a) => norm(vals[f] || '').length > 1 && lev(norm(vals[f] || ''), a) <= 1))
  const st = getState().items['v:' + v.id]
  const fam = family(v)

  const prompt = task === 'forms' || task === 'listen' ? (task === 'listen' ? null : v.slo) : task === 'si' ? v.id : v.shown[given!][0]
  const sub =
    task === 'forms' ? (v.dup ? `angleško se začne na »${v.id[0]}«, ${v.id.length} črk` : 'napiši vse tri oblike')
      : task === 'inf' ? v.slo
        : task === 'reverse' ? `to je ${given === 'pp' ? 'past participle' : 'past simple'}; napiši ostali obliki`
          : task === 'si' ? 'he / she / it in -ing oblika'
            : 'poslušaj obliko in napiši vse tri'

  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{TASK_NAME[task]}{brutal && !res && <TimerRing left={left} total={total} />}</span></div>
      {task === 'listen' ? (
        <>
          <motion.button className="play" onClick={() => say(heard)} whileTap={{ scale: 0.92 }} aria-label="Predvajaj znova">
            <motion.span className="ring" animate={{ scale: [1, 1.25], opacity: [0.6, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
            <Play />
          </motion.button>
          <div className="qhint" style={{ textAlign: 'center' }}>{sub}</div>
        </>
      ) : (
        <>
          <div className={'qword' + (prompt && prompt.length > 14 ? ' long' : '')} lang={task === 'forms' ? 'sl' : 'en'}>{prompt}</div>
          <div className="qhint">{sub}</div>
        </>
      )}
      <div className="fields">
        {given && task === 'inf' && <Kinetic label="Infinitive" value={v.id} onChange={() => {}} status="idle" given readOnly />}
        {fields.map((f, i) => (
          <Kinetic key={f}
            ref={(el) => { refs.current[f] = el }}
            label={labels[f]}
            value={vals[f] || ''}
            onChange={(x) => setVals((s) => ({ ...s, [f]: x }))}
            onEnter={() => enter(i)}
            status={!res ? 'idle' : res[f] || over ? 'ok' : 'bad'}
            correct={answerOf(f).join(' / ')}
            enterKeyHint={i === fields.length - 1 ? 'done' : 'next'}
            note={res && res[f] && checkForm(vals[f] || '', acceptOf(f)).parts.some((p) => !answerOf(f).includes(p)) ? `Sprejeto. Na listu: ${answerOf(f).join(' / ')}` : undefined}
          />
        ))}
      </div>

      <AnimatePresence>
        {res && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.1 }}>
            <h3>{good ? (hints ? 'Pravilno, z namigom' : 'Pravilno') : 'Še ne'}</h3>
            <div className="forms" lang="en">
              {task === 'si' ? (<>{v.id}<span>·</span>{v.third}<span>·</span>{v.ing}</>) : (<>{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</>)}
            </div>
            <p>{v.slo}{task !== 'si' && <>. Vzorec: {TYPE_TXT[v.type]}</>}.{st && st.lapses >= 3 && <> <b style={{ color: 'var(--coral)' }}>Pozabljen že {st.lapses}×.</b></>}</p>
            {v.note && <p>{v.note}</p>}
            {task !== 'si' && fam.length > 0 && <div className="fam"><b>Isti vzorec:</b> {fam.map((x) => `${x.shown.inf[0]} ${x.shown.past[0]} ${x.shown.pp[0]}`).join(' · ')}</div>}
            <p>{good ? <>Naslednjič čez <b>{st ? fmtDue(st.due) : 'kmalu'}</b>.</> : 'Vrne se čez nekaj nalog, dokler ga ne napišeš pravilno.'}</p>
            {nearMiss && !over && (
              <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: (Date.now() - t0.current) / 1000 }) }}>Tipkarska napaka, štej kot pravilno</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="s-actions">
        {!res ? (
          <>
            {!brutal && <button className="btn sm" onClick={hint}><Lightbulb />Namig</button>}
            <button className="btn sm" onClick={() => submit(true)}>Ne vem</button>
            <button className="btn sm primary" onClick={() => submit()}>Preveri</button>
          </>
        ) : (
          <>
            {canSpeak() && <button className="btn sm" style={{ flex: '0 0 auto' }} onClick={() => say()} aria-label="Izgovori"><Volume2 /></button>}
            <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>
          </>
        )}
      </div>
      {!res && <div className="kbd">Enter premakne naprej in preveri</div>}
    </div>
  )
}

/* ───────────────────────── glagol v stavku ───────────────────────── */
function ContextQ({ entry, onAnswer, onOverride, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'verb' }>
  const v = item.verb
  const s = useMemo(() => sentFor(entry.uid, v.id), [entry.uid, v.id])
  const [, form, text, sl] = s
  // glas za stavek se pripravi že med reševanjem, zato po odgovoru zaigra brez čakanja
  useEffect(() => { if (getState().settings.speech) void prepare(text.replace('___', v.shown[form][0])) }, [text, form, v])
  useReadTask(text, v.id)
  const [val, setVal] = useState('')
  const [res, setRes] = useState<null | boolean>(null)
  const [over, setOver] = useState(false)
  const t0 = useRef(Date.now())
  const inp = useRef<HTMLInputElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const brutal = false
  const left = useTimer(brutal && res === null, 14, () => submit(true))
  useEffect(() => { const t = setTimeout(() => inp.current?.focus({ preventScroll: true }), 120); return () => clearTimeout(t) }, [])
  function submit(timeout = false) {
    if (res !== null) return
    if (!timeout && !val.trim()) return
    const ok = checkForm(val, v.accept[form]).ok
    setRes(ok)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.3, 0), errFields: ok ? [] : [form], secs })
    if (getState().settings.speech) setTimeout(() => speak(text.replace('___', v.shown[form][0])), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  const [a, b] = text.split('___')
  const good = !!res || over
  const near = res === false && v.shown[form].some((x) => lev(norm(val), x) === 1)
  const st = getState().items['v:' + v.id]
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={text} hint={v.id} /></span><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>V stavku{brutal && res === null && <TimerRing left={left} total={14} />}</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>
        {a}
        <Kinetic ref={inp} inline value={val} onChange={setVal} onEnter={() => (res === null ? submit() : onNext())}
          status={res === null ? 'idle' : good ? 'ok' : 'bad'} correct={v.shown[form].join('/')} ariaLabel={`${form === 'past' ? 'Past simple' : 'Past participle'} glagola ${v.id}`} />
        {b}
      </div>
      <div className="qhint" style={{ marginTop: 10 }}>({v.id}) · {sl}</div>
      <AnimatePresence>
        {res !== null && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}>
            <h3>{good ? 'Pravilno' : 'Še ne'}<Listen text={text.replace('___', v.shown[form][0])} /></h3>
            <div className="forms" lang="en">{v.shown.inf[0]}<span>·</span>{v.shown.past.join('/')}<span>·</span>{v.shown.pp.join('/')}</div>
            <p>Tu je potreben {form === 'past' ? 'past simple' : 'past participle'}{form === 'pp' ? ' (za have/has/had ali trpnik)' : ''}.</p>
            {good && st && <p>Naslednjič čez <b>{fmtDue(st.due)}</b>.</p>}
            {near && !over && <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 5 }) }}>Tipkarska napaka, štej kot pravilno</button>}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {res === null ? (
          <>
            <button className="btn sm" onClick={() => submit(true)}>Ne vem</button>
            <button className="btn sm primary" onClick={() => submit()}>Preveri</button>
          </>
        ) : (
          <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────── lov na napako ───────────────────────── */
function HuntQ({ entry, onAnswer, onNext }: { entry: Entry; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'verb' }>
  const v = item.verb
  const opts = useMemo(() => {
    const right: [string, string, string] = [v.shown.inf[0], v.shown.past[0], v.shown.pp[0]]
    const seen = new Set([right.join()])
    const out: { t: [string, string, string]; ok: boolean }[] = [{ t: right, ok: true }]
    let guard = 0
    while (out.length < 4 && guard++ < 40) {
      const which = Math.random() < 0.5 ? 'past' : 'pp'
      const fake = fakeForm(v, which)
      const t: [string, string, string] = which === 'past' ? [right[0], fake, right[2]] : [right[0], right[1], fake]
      if (Math.random() < 0.25) { const f2 = fakeForm(v, which === 'past' ? 'pp' : 'past'); if (which === 'past') t[2] = f2; else t[1] = f2 }
      if (!seen.has(t.join()) && !(v.accept.past.has(t[1]) && v.accept.pp.has(t[2]))) { seen.add(t.join()); out.push({ t, ok: false }) }
    }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
    return out
  }, [v])
  const [pick, setPick] = useState<number | null>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  const choose = (i: number) => {
    if (pick !== null) return
    setPick(i)
    const ok = opts[i].ok
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1, 0), secs })
    if (getState().settings.speech) setTimeout(() => speakVerb(v.id, [v.shown.inf[0], v.shown.past.join(' or '), v.shown.pp.join(' or ')].join(', ')), ok ? 60 : 350)
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (pick === null && n >= 1 && n <= opts.length) choose(n - 1) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  return (
    <div className="qcard glass">
      <div className="qmeta"><Tag entry={entry} /><span>Lov na napako</span></div>
      <div className="qword" lang="sl">{v.slo}</div>
      <div className="qhint">Samo ena trojica je pravilna. Ostale so pasti.</div>
      <div className="choices">
        {opts.map((o, i) => (
          <motion.button key={i} className={'choice' + (pick === null ? '' : o.ok ? ' ok' : i === pick ? ' bad' : ' dim')} onClick={() => choose(i)}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.08 + i * 0.06 }}>
            <span className="key">{pick !== null && o.ok ? <Check size={15} /> : i + 1}</span>
            <span className="trip" lang="en">{o.t[0]}<span>·</span>{o.t[1]}<span>·</span>{o.t[2]}</span>
          </motion.button>
        ))}
      </div>
      {pick !== null && (
        <>
          <motion.div className={'result ' + (opts[pick].ok ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{opts[pick].ok ? 'Ujel si pravo' : 'Ujel si se v past'}</h3>
            <p>Vzorec: {TYPE_TXT[v.type]}.{v.note ? ` ${v.note}` : ''}</p>
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────────────────────── slovnica: vtipkaj ───────────────────────── */
const JEV_KIND: Record<string, string> = {
  typo: 'Tipkarska napaka: prava beseda, napačno črkovanje',
  form: 'Prava beseda, napačna oblika',
  near: 'Blizu po pomenu, a ne ta beseda',
  wrong: 'Druga beseda z drugim pomenom',
  other: 'To ni odgovor na nalogo',
}
/** Kratka oznaka, kaj je Jev ugotovil o odgovoru. */
function JevChip({ d }: { d: Diag | 'load' }) {
  if (d === 'load') return <div className="jev-chip load"><Sparkles />Jev preverja odgovor …</div>
  if (d.accept >= 0.85) return <motion.div className="jev-chip ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}><Sparkles />Jev: tvoj odgovor je sprejemljiva različica, štejem kot pravilno</motion.div>
  return <motion.div className="jev-chip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}><Sparkles />{JEV_KIND[d.kind] || JEV_KIND.wrong}</motion.div>
}

function TypeQ({ entry, card, onAnswer, onOverride, onNext }: { entry: Entry; card: TypeCard; onAnswer: (r: Result) => void; onOverride: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'card' }>
  const [val, setVal] = useState('')
  const [res, setRes] = useState<null | boolean>(null)
  const [over, setOver] = useState(false)
  // postopni namig: najprej prva črka, nato polovica besede; namig zniža oceno, a odgovor še vedno šteje
  const [hintN, setHintN] = useState(0)
  const [jd, setJd] = useState<Diag | 'load' | null>(null)
  const hintTxt = hintN ? card.a[0].slice(0, Math.max(1, Math.ceil(card.a[0].length * (hintN === 1 ? 0.2 : 0.5)))) + '…' : ''
  const t0 = useRef(Date.now())
  const inp = useRef<HTMLInputElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => { const t = setTimeout(() => inp.current?.focus({ preventScroll: true }), 120); return () => clearTimeout(t) }, [])
  const spoken = correctSpoken(card.q, card.a[0])
  useEffect(() => { if (spoken && getState().settings.speech) void prepare(spoken) }, [spoken])
  useReadTask(card.q)
  const submit = (gaveUp = false) => {
    if (res !== null) return
    if (!gaveUp && !val.trim()) return
    const ok = !gaveUp && checkText(val, card.a)
    if (spoken && getState().settings.speech) setTimeout(() => speak(spoken), ok ? 60 : 350)
    setRes(ok)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.4, hintN), secs })
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
    // Jev v ~0,2 s presodi napačen odgovor: sprejemljiva različica (štej kot pravilno) ali vrsta napake
    if (!ok && !gaveUp && val.trim()) {
      setJd('load')
      void diagnose(card.q, card.a, val.trim()).then((d) => {
        setJd(d)
        if (d && d.accept >= 0.85) { setOver(true); onOverride({ ok: true, grade: 3, secs }) }
      })
    }
  }
  const best = card.a.reduce((a, b) => (lev(norm(val), norm(b)) < lev(norm(val), norm(a)) ? b : a))
  const good = !!res || over
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={card.q} /></span><span>{item.deck.short}</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>{card.q}</div>
      {card.hint && <div className="qhint" style={{ marginTop: 8 }}>Namig: <span lang="en">{card.hint}</span></div>}
      {res === null && card.a[0].length > 2 && (
        <div className="hintline">
          <button className="btn ghost sm" disabled={hintN >= 2} onClick={() => { setHintN((h) => h + 1); inp.current?.focus() }}><Lightbulb />{hintN === 0 ? 'Namig' : hintN === 1 ? 'Še en namig' : 'Ni več namigov'}</button>
          {hintTxt && <motion.span key={hintN} className="hintw" lang="en" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>{hintTxt}</motion.span>}
        </div>
      )}
      <div className="fields">
        <Kinetic ref={inp} value={val} onChange={setVal} onEnter={() => (res === null ? submit() : onNext())} status={res === null ? 'idle' : good ? 'ok' : 'bad'} correct={best} ariaLabel="Odgovor" />
      </div>
      <AnimatePresence>
        {res !== null && (
          <motion.div className={'result ' + (good ? 'good' : 'bad')} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}>
            <h3>{good ? 'Pravilno' : 'Še ne'}{spoken && <Listen text={spoken} />}</h3>
            {jd && <JevChip d={jd} />}
            {card.note && <p>{card.note}</p>}
            {card.a.length > 1 && <p>Sprejeto: {card.a.join(', ')}</p>}
            {res === false && !over && val.trim() && (lev(norm(val), norm(best)) === 1 || (jd && jd !== 'load' && jd.kind === 'typo')) && <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => { setOver(true); onOverride({ ok: true, grade: 3, secs: 5 }) }}>Tipkarska napaka, štej kot pravilno</button>}
            {!good && <Why task={card.q} given={val} correct={card.a.join(' / ')} ctx={card.note} />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="s-actions">
        {res === null ? (
          <><button className="btn sm" onClick={() => submit(true)}>Ne vem</button><button className="btn sm primary" onClick={() => submit()}>Preveri</button></>
        ) : (
          <button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────── slovnica: izbira ───────────────────────── */
function ChoiceQ({ entry, card, onAnswer, onNext }: { entry: Entry; card: ChoiceCard; onAnswer: (r: Result) => void; onNext: () => void }) {
  const item = entry.item as Extract<QItem, { kind: 'card' }>
  const order = useMemo(() => {
    const idx = card.options.map((_, i) => i)
    if (card.options.every((o) => o.length <= 6)) return idx
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
    return idx
  }, [card])
  const [pick, setPick] = useState<number | null>(null)
  const t0 = useRef(Date.now())
  const nextBtn = useRef<HTMLButtonElement>(null)
  const spoken = correctSpoken(card.q, card.options[card.correct])
  useEffect(() => { if (spoken && getState().settings.speech) void prepare(spoken) }, [spoken])
  useReadTask(card.q)
  const choose = (i: number) => {
    if (pick !== null) return
    setPick(i)
    const ok = i === card.correct
    if (spoken && getState().settings.speech) setTimeout(() => speak(spoken), ok ? 60 : 350)
    const secs = (Date.now() - t0.current) / 1000
    onAnswer({ ok, grade: gradeFor(ok, item.key, secs, 1.1, 0), secs })
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 60)
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (pick === null && n >= 1 && n <= order.length) choose(order[n - 1]) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  const parts = card.q.split('___')
  return (
    <div className="qcard glass">
      <div className="qmeta"><span className="qmeta-l"><Tag entry={entry} /><TaskSay q={card.q} /></span><span>{item.deck.short}</span></div>
      <div className="qword sentence" lang="en" style={{ marginTop: 22 }}>
        {parts.map((p, i) => (
          <span key={i}>{p}{i < parts.length - 1 && (
            <motion.span className={'gap' + (pick === null ? '' : pick === card.correct ? ' ok' : ' bad')} layout>
              {pick === null || card.options[card.correct].length > 28 ? ' ' : card.options[card.correct]}
            </motion.span>
          )}</span>
        ))}
      </div>
      <div className="choices">
        {order.map((oi, n) => (
          <motion.button key={oi} className={'choice' + (pick === null ? '' : oi === card.correct ? ' ok' : oi === pick ? ' bad' : ' dim')} onClick={() => choose(oi)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 + n * 0.05 }}>
            <span className="key">{pick !== null && oi === card.correct ? <Check size={15} /> : n + 1}</span>
            {card.options[oi]}
          </motion.button>
        ))}
      </div>
      {pick !== null && (
        <>
          <motion.div className={'result ' + (pick === card.correct ? 'good' : 'bad')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h3>{pick === card.correct ? 'Pravilno' : 'Še ne'}{spoken && <Listen text={spoken} />}</h3>
            {card.note && <p>{card.note}</p>}
            {pick !== card.correct && <Why task={`${card.q} (možnosti: ${card.options.join(' | ')})`} given={card.options[pick]} correct={card.options[card.correct]} ctx={card.note} />}
          </motion.div>
          <div className="s-actions"><button ref={nextBtn} className="btn sm primary" onClick={onNext}>Naprej<ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

/* ───────────────────────── povzetek ───────────────────────── */
function CountUp({ to, dur = 1.1 }: { to: number; dur?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const f = (t: number) => {
      const k = Math.min(1, (t - t0) / (dur * 1000))
      setN(Math.round(to * (1 - Math.pow(1 - k, 4))))
      if (k < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [to, dur])
  return <>{n}</>
}

function Summary({ title, stats, onClose }: { title: string; stats: { first: Map<string, boolean>; missed: Set<string>; answered: number; start: number; theta0: number; best: number; xp?: number; placement: boolean }; onClose: () => void }) {
  const firsts = [...stats.first.values()]
  const acc = firsts.length ? Math.round((firsts.filter(Boolean).length / firsts.length) * 100) : 0
  const mins = Math.max(1, Math.round((Date.now() - stats.start) / 60000))
  const missed = [...stats.missed]
  const [redo, setRedo] = useState<QItem[] | null>(null)
  const st = getState()
  const delta = rating(st.profile.theta) - rating(stats.theta0)
  if (redo) return <Session items={redo} title="Napake" onClose={onClose} />
  return (
    <motion.div className="qcard glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: 'easeOut' as const }}>
      <div className="qmeta"><span className="k place">{title}</span><span>{mins} min</span></div>
      <div className="big num"><CountUp to={acc} /><small>% prvič pravilno</small></div>
      {title === 'Preverjanje' && (
        <motion.div className={'mock-grade g' + gradeOf(acc)} initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.8 }}>
          <b>{gradeOf(acc)}</b><span>ocena ({firsts.filter(Boolean).length}/{firsts.length} točk)<br /><small>meje 50, 63, 76, 89 %</small></span>
        </motion.div>
      )}
      <div className="stats3">
        <div><b className="num">{rating(st.profile.theta)}</b><span>rating <span className={'delta ' + (delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '+' : ''}{delta}</span></span></div>
        <div><b className="num">+{stats.xp || 0}</b><span>XP v seji</span></div>
        <div><b className="num">×{stats.best}</b><span>najdaljši niz</span></div>
      </div>
      {stats.placement && <p className="lead">Uvrstitev končana. Lahke glagole, ki jih že znaš, algoritem odloži za dolgo, novi pa bodo na meji tvojega znanja.</p>}
      {missed.length > 0 ? (
        <>
          <div className="section-title" style={{ marginTop: 24 }}><span className="h3">Napake</span><span className="small muted">{missed.length}</span></div>
          <div className="list glass" style={{ borderRadius: 20 }}>
            {missed.slice(0, 12).map((k) => { const it = keyLabel(k); return <div key={k} className="li"><div className="li-main"><span className="li-t">{it.t}</span><span className="li-s">{it.s}</span></div></div> })}
          </div>
          <button className="btn w primary" style={{ marginTop: 14 }} onClick={() => setRedo(missed.map((k) => itemFromKey(k, st.items, st.settings)).filter(Boolean) as QItem[])}><RotateCcw />Še enkrat samo napake</button>
        </>
      ) : !stats.placement ? (
        <p className="lead">Brez napak. Te glagole boš videl šele tik preden bi jih pozabil.</p>
      ) : null}
      <button className="btn w" style={{ marginTop: 10 }} onClick={onClose}>Končaj</button>
    </motion.div>
  )
}

const gradeOf = (p: number) => (p >= 89 ? 5 : p >= 76 ? 4 : p >= 63 ? 3 : p >= 50 ? 2 : 1)

function keyLabel(k: string): { t: string; s: string } {
  if (k.startsWith('v')) {
    const v: Verb = VERB_BY_ID[k.split(':')[1]]
    return { t: `${v.id} · ${v.shown.past.join('/')} · ${v.shown.pp.join('/')}`, s: v.slo }
  }
  const [d, c] = k.slice(2).split('/')
  const card = DECK_BY_ID[d]?.cards.find((x) => x.id === c)
  const a = card ? (card.kind === 'type' ? card.a[0] : card.kind === 'explain' || card.kind === 'write' ? 'pisna naloga' : card.options[card.correct]) : ''
  return { t: card?.q || k, s: a }
}

export type { KinStatus }
