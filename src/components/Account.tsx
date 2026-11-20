import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, LogOut, ArrowLeft } from 'lucide-react'
import { supabase, SUPABASE_URL, SUPABASE_KEY, OFFLINE } from '../lib/supabase'
import { useStore, setSettings, signOut, resetAll } from '../lib/store'
import { sfx } from '../lib/sound'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  )
}

const redirect = () => window.location.origin + window.location.pathname

export function SignIn({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [googleOn, setGoogleOn] = useState(false)

  // Gumb za Google pokažemo samo, ko je ponudnik v Supabase res vklopljen, sicer bi vodil na napako.
  useEffect(() => {
    if (OFFLINE || !SUPABASE_URL) return
    fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json()).then((j) => setGoogleOn(!!j?.external?.google)).catch(() => setGoogleOn(false))
  }, [])

  const google = async () => {
    setErr('')
    sfx.tap()
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } })
    if (error) setErr(/provider is not enabled|Unsupported provider/i.test(error.message) ? 'Prijava z Googlom še ni vklopljena. Uporabi e-pošto.' : 'Prijava z Googlom ni uspela. Poskusi znova ali uporabi e-pošto.')
  }
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Vpiši veljaven e-poštni naslov.')
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: redirect() } })
    setBusy(false)
    if (error) setErr(error.status === 429 ? 'Preveč poskusov. Počakaj minuto in poskusi znova.' : `Sporočila ni bilo mogoče poslati (${error.message}).`)
    else { setEmail(em); setStage('code') }
  }
  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) { sfx.bad(); setErr('Koda ni pravilna ali je potekla. Pošlji novo.') }
    else { sfx.ok(); onDone?.() }
  }

  if (OFFLINE) return (
    <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
      To je open source različica brez računov in strežnika. Napredek se shrani samo v tem brskalniku.
    </p>
  )

  return (
    <div>
      {!compact && <>
        <div className="auth-hero">Shrani svoj napredek</div>
        <p className="muted" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>S prijavo se napredek shrani v oblak in te počaka na vsaki napravi. Brez prijave ostane samo v tem brskalniku.</p>
      </>}
      {googleOn && <>
        <button className="oauth" onClick={google}><GoogleIcon />Nadaljuj z Googlom</button>
        <div className="or">ali s povezavo po e-pošti</div>
      </>}
      {stage === 'email' ? (
        <form onSubmit={sendCode}>
          <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="ime@primer.si" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-pošta" />
          <button className="btn primary w" style={{ marginTop: 10 }} disabled={busy}><Mail />{busy ? 'Pošiljam …' : 'Pošlji povezavo za prijavo'}</button>
        </form>
      ) : (
        <motion.form onSubmit={verify} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45 }}>
          <p className="small muted" style={{ margin: '0 0 10px', lineHeight: 1.5 }}>Poslali smo ti sporočilo na <b style={{ color: 'var(--ink)' }}>{email}</b>. Odpri ga in klikni povezavo za prijavo; odpre English Lab že prijavljen. Če je v sporočilu šestmestna koda, jo lahko vpišeš tudi spodaj.</p>
          <input className="field code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Koda" autoFocus />
          <button className="btn primary w" style={{ marginTop: 10 }} disabled={busy || code.length < 6}>{busy ? 'Preverjam …' : 'Prijava'}</button>
          <button type="button" className="btn ghost w sm" style={{ marginTop: 6 }} onClick={() => { setStage('email'); setCode(''); setErr('') }}><ArrowLeft />Drug naslov</button>
        </motion.form>
      )}
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  )
}

export function SettingsSections({ toast }: { toast: (m: string) => void }) {
  const session = useStore((s) => s.session)
  const settings = useStore((s) => s.settings)
  const items = useStore((s) => s.items)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div>
      <div className="section-title"><span className="h2">Zvok</span></div>
      <div className="glass list">
        <div className="set">
          <div className="set-l">Zvočni učinki<small>Pravilno, napačno, niz</small></div>
          <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} aria-label="Zvočni učinki" />
        </div>
        <div className="set">
          <div className="set-l">Izgovorjava<small>Glas brskalnika po odgovoru in pri nareku</small></div>
          <input type="checkbox" className="switch" checked={settings.speech} onChange={(e) => setSettings({ speech: e.target.checked })} aria-label="Izgovorjava" />
        </div>
      </div>

      <div className="section-title"><span className="h2">Podatki</span></div>
      <div className="glass list">
        <div className="set">
          <div className="set-l">Varnostna kopija<small>{Object.keys(items).length} zapisov v spominu</small></div>
          <button className="btn sm" onClick={async () => {
            try { await navigator.clipboard.writeText(JSON.stringify({ items, settings })); toast('Kopirano v odložišče.') } catch { toast('Kopiranje ni uspelo.') }
          }}>Kopiraj</button>
        </div>
        <div className="set">
          <div className="set-l">Ponastavi ves napredek</div>
          {confirmReset ? (
            <div className="row" style={{ flex: 'none' }}>
              <button className="btn sm" onClick={() => setConfirmReset(false)}>Ne</button>
              <button className="btn sm danger" onClick={async () => { await resetAll(); setConfirmReset(false); toast('Napredek je ponastavljen.') }}>Izbriši</button>
            </div>
          ) : (
            <button className="btn sm danger" onClick={() => setConfirmReset(true)}>Ponastavi</button>
          )}
        </div>
        {session && (
          <div className="set">
            <div className="set-l">Odjava<small>Napredek ostane v računu</small></div>
            <button className="btn sm" onClick={() => signOut()}><LogOut />Odjava</button>
          </div>
        )}
      </div>
      <p className="tiny muted" style={{ marginTop: 18, lineHeight: 1.55 }}>
        English Lab ponavlja po algoritmu FSRS 5, sproti meri tvojo raven in med vajo prilagaja težavnost. Glagoli so z lista Angleški nepravilni glagoli (Gozdni sklad), slovnica iz tvojih zapiskov.
      </p>
    </div>
  )
}
