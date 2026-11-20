import { forwardRef, type KeyboardEvent } from 'react'
import { diff, norm } from '../lib/check'

// Polje za odgovor: pravo, vidno vnosno polje (hitro in brez hroščev s kazalcem na telefonu).
// Ob napaki se polje strese, tvoj odgovor se prečrta, pod njim se pokaže pravilna oblika
// z označenimi črkami, ki si jih zgrešil. Ob pravilnem odgovoru polje poskoči in dobi kljukico.

export type KinStatus = 'idle' | 'ok' | 'bad'
interface Props {
  label?: string
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  status: KinStatus
  correct?: string
  readOnly?: boolean
  given?: boolean
  lang?: string
  inline?: boolean
  note?: string
  enterKeyHint?: 'next' | 'done' | 'go'
  ariaLabel?: string
}

export const Kinetic = forwardRef<HTMLInputElement, Props>(function Kinetic(
  { label, value, onChange, onEnter, status, correct, readOnly, given, lang = 'en', inline, note, enterKeyHint = 'done', ariaLabel },
  ref,
) {
  const showCorrect = status === 'bad' && correct !== undefined
  const pieces = showCorrect ? diff(norm(value), correct!) : null
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
  }
  return (
    <div className={`kin ${status}${given ? ' given' : ''}${inline ? ' inline-kin' : ''}`}>
      {label && <label>{label}</label>}
      <div className="kin-box">
        <input
          ref={ref}
          className="kin-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          readOnly={readOnly || status !== 'idle'}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
          enterKeyHint={enterKeyHint} lang={lang} aria-label={ariaLabel || label}
          placeholder={inline ? '…' : ''}
          style={inline ? { width: Math.max(110, (Math.max(value.length, correct?.length || 0) + 2) * 12) } : undefined}
        />
        {status === 'ok' && <span className="kin-mark" aria-hidden="true">✓</span>}
      </div>
      {showCorrect && !inline && (
        <div className="kin-fix" lang={lang}>
          {pieces!.map((p, i) => <span key={i} className={p.miss ? 'miss' : ''}>{p.t}</span>)}
        </div>
      )}
      {note && <div className="kin-note">{note}</div>}
    </div>
  )
})
