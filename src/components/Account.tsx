import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, LogOut, ArrowLeft, KeyRound, Check } from 'lucide-react'
import { supabase, SUPABASE_URL, SUPABASE_KEY, OFFLINE } from '../lib/supabase'
import { useStore, setSettings, signOut, resetAll } from '../lib/store'
import { sfx } from '../lib/sound'
import { PROVIDERS, getLlm, setLlm, testLlm, type Provider } from '../lib/llm'

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

  // The Google button is shown only when the provider is really enabled in Supabase, otherwise it would lead to an error.
  useEffect(() => {
    if (OFFLINE || !SUPABASE_URL) return
    fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json()).then((j) => setGoogleOn(!!j?.external?.google)).catch(() => setGoogleOn(false))
  }, [])

  const google = async () => {
    setErr('')
    sfx.tap()
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } })
    if (error) setErr(/provider is not enabled|Unsupported provider/i.test(error.message) ? 'Google sign in is not enabled yet. Use email.' : 'Google sign in failed. Try again or use email.')
  }
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Enter a valid email address.')
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: redirect() } })
    setBusy(false)
    if (error) setErr(error.status === 429 ? 'Too many attempts. Wait a minute and try again.' : `The message could not be sent (${error.message}).`)
    else { setEmail(em); setStage('code') }
  }
  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) { sfx.bad(); setErr('The code is wrong or has expired. Send a new one.') }
    else { sfx.ok(); onDone?.() }
  }

  if (OFFLINE) return (
    <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
      This is the open source build without accounts or a server. Progress is saved only in this browser.
    </p>
  )

  return (
    <div>
      {!compact && <>
        <div className="auth-hero">Save your progress</div>
        <p className="muted" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>Signing in saves your progress to the cloud so it waits for you on every device. Without signing in it stays only in this browser.</p>
      </>}
      {googleOn && <>
        <button className="oauth" onClick={google}><GoogleIcon />Continue with Google</button>
        <div className="or">or with an email link</div>
      </>}
      {stage === 'email' ? (
        <form onSubmit={sendCode}>
          <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <button className="btn primary w" style={{ marginTop: 10 }} disabled={busy}><Mail />{busy ? 'Sending …' : 'Send sign in link'}</button>
        </form>
      ) : (
        <motion.form onSubmit={verify} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45 }}>
          <p className="small muted" style={{ margin: '0 0 10px', lineHeight: 1.5 }}>We sent you a message at <b style={{ color: 'var(--ink)' }}>{email}</b>. Open it and click the link to sign in; it opens English Lab already signed in. If the message has a six digit code, you can also type it below.</p>
          <input className="field code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Code" autoFocus />
          <button className="btn primary w" style={{ marginTop: 10 }} disabled={busy || code.length < 6}>{busy ? 'Checking …' : 'Sign in'}</button>
          <button type="button" className="btn ghost w sm" style={{ marginTop: 6 }} onClick={() => { setStage('email'); setCode(''); setErr('') }}><ArrowLeft />Another address</button>
        </motion.form>
      )}
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  )
}

/** Settings block for bring your own key: provider, API key and model. The key stays in this browser. */
export function AiKeySection({ toast }: { toast: (m: string) => void }) {
  const saved = getLlm()
  const [provider, setProvider] = useState<Provider>(saved?.provider || 'openrouter')
  const [key, setKey] = useState(saved?.key || '')
  const [model, setModel] = useState(saved?.model || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [on, setOn] = useState(!!saved)
  const p = PROVIDERS[provider]

  const save = async () => {
    const k = key.trim()
    if (k.length < 12) return setErr('Paste your API key first.')
    setBusy(true); setErr('')
    const cfg = { provider, key: k, model: model.trim() || p.model }
    const problem = await testLlm(cfg)
    setBusy(false)
    if (problem) { sfx.bad(); setErr(problem); return }
    setLlm(cfg); setOn(true); setModel(cfg.model); sfx.ok()
    toast(`Connected to ${p.name}. AI features are on.`)
  }
  const remove = () => { setLlm(null); setKey(''); setOn(false); setErr(''); toast('The key was removed from this browser.') }

  return (
    <>
      <div className="section-title"><span className="h2">AI features</span></div>
      <div className="glass list">
        <div className="set stack">
          <div className="set-l">Your own API key<small>{on ? `On: ${PROVIDERS[getLlm()?.provider || provider].name}, ${getLlm()?.model}` : 'Off. Adds new AI made tasks, “Why is it wrong?” explanations, grading of explanations and writing, and smarter answer checking.'}</small></div>
          <div className="seg" role="radiogroup" aria-label="Provider">
            {(Object.keys(PROVIDERS) as Provider[]).map((id) => (
              <button key={id} role="radio" aria-checked={provider === id} className={provider === id ? 'on' : ''} onClick={() => { setProvider(id); setModel(''); setErr('') }}>{PROVIDERS[id].name}</button>
            ))}
          </div>
          <input className="field" type="password" autoComplete="off" spellCheck={false} placeholder={`API key (${p.keyHint})`} value={key} onChange={(e) => setKey(e.target.value)} aria-label="API key" />
          <input className="field" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={`Model (default ${p.model})`} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" />
          <div className="row">
            <button className="btn primary sm" disabled={busy} onClick={save}>{busy ? 'Testing …' : <><Check />Test and save</>}</button>
            {on && <button className="btn sm" onClick={remove}>Remove key</button>}
          </div>
          {err && <div className="err" role="alert" style={{ marginTop: 0 }}>{err}</div>}
          <p className="tiny muted" style={{ margin: 0, lineHeight: 1.5 }}>
            <KeyRound size={12} style={{ verticalAlign: '-1px' }} /> The key is stored only in this browser and is sent only to {p.name}. Usage is billed to your account there. Get a key at <a href={p.keysUrl} target="_blank" rel="noreferrer">{p.keysUrl.replace('https://', '')}</a>. Do not save a key on a shared device.
          </p>
        </div>
      </div>
    </>
  )
}

export function SettingsSections({ toast }: { toast: (m: string) => void }) {
  const session = useStore((s) => s.session)
  const settings = useStore((s) => s.settings)
  const items = useStore((s) => s.items)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div>
      <div className="section-title"><span className="h2">Sound</span></div>
      <div className="glass list">
        <div className="set">
          <div className="set-l">Sound effects<small>Correct, wrong, streak</small></div>
          <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} aria-label="Sound effects" />
        </div>
        <div className="set">
          <div className="set-l">Pronunciation<small>Browser voice after an answer and in dictation</small></div>
          <input type="checkbox" className="switch" checked={settings.speech} onChange={(e) => setSettings({ speech: e.target.checked })} aria-label="Pronunciation" />
        </div>
      </div>

      <AiKeySection toast={toast} />

      <div className="section-title"><span className="h2">Data</span></div>
      <div className="glass list">
        <div className="set">
          <div className="set-l">Backup<small>{Object.keys(items).length} saved records</small></div>
          <button className="btn sm" onClick={async () => {
            try { await navigator.clipboard.writeText(JSON.stringify({ items, settings })); toast('Copied to the clipboard.') } catch { toast('Copying failed.') }
          }}>Copy</button>
        </div>
        <div className="set">
          <div className="set-l">Reset all progress</div>
          {confirmReset ? (
            <div className="row" style={{ flex: 'none' }}>
              <button className="btn sm" onClick={() => setConfirmReset(false)}>No</button>
              <button className="btn sm danger" onClick={async () => { await resetAll(); setConfirmReset(false); toast('Progress has been reset.') }}>Delete</button>
            </div>
          ) : (
            <button className="btn sm danger" onClick={() => setConfirmReset(true)}>Reset</button>
          )}
        </div>
        {session && (
          <div className="set">
            <div className="set-l">Sign out<small>Progress stays in the account</small></div>
            <button className="btn sm" onClick={() => signOut()}><LogOut />Sign out</button>
          </div>
        )}
      </div>
      <p className="tiny muted" style={{ marginTop: 18, lineHeight: 1.55 }}>
        English Lab schedules reviews with the FSRS 5 algorithm, measures your level as you go and adjusts the difficulty during practice. The verbs come from the Slovenian school list of English irregular verbs, the grammar from class notes.
      </p>
    </div>
  )
}
