import { useEffect } from 'react'
import { gapText, speakTask } from '../lib/speech'
import { Volume2 } from 'lucide-react'
import type { QItem } from '../lib/content'
import type { Grade } from '../lib/fsrs'
import type { Form } from '../lib/verbs'
import { getState } from '../lib/store'
import { effDiff } from '../lib/content'

export type Kind = 'first' | 'retry' | 'confirm' | 'similar'
export interface Entry { item: QItem; kind: Kind; uid: number; fresh: boolean; ai?: boolean; hard?: boolean }
export interface Result { ok: boolean; grade: Grade; errFields?: Form[]; secs: number }

export const spring = { duration: 0.5, ease: 'easeOut' as const }

export function Tag({ entry }: { entry: Entry }) {
  const it = entry.item
  if (it.kind === 'verb' && it.placement) return <span className="k place">Uvrstitev</span>
  if (entry.kind === 'retry') return <span className="k retry">Ponovi napako</span>
  if (entry.kind === 'confirm') return <span className="k retry">Utrdi</span>
  if (entry.kind === 'similar') return <span className="k sim">Podobna</span>
  if (entry.hard) return <span className="k hard">Izziv</span>
  if (entry.ai) return <span className="k ai">Novo od AI</span>
  if (entry.fresh) return <span className="k fresh">Novo</span>
  return <span className="k review">Ponovitev</span>
}


export function gradeFor(ok: boolean, key: string, secs: number, nFields: number, hints: number): Grade {
  if (!ok) return 1
  if (hints > 0) return 2
  const diff = effDiff()
  const slow = diff === 'normal' ? 11 : diff === 'hard' ? 8 : 6
  if (secs > nFields * slow) return 2
  const c = getState().items[key]
  if (c && c.reps >= 2 && secs < nFields * 3) return 4
  return 3
}


/** Prebere navodilo naloge (z vrzeljo kot premorom), takoj ko se naloga pokaže. */
export function useReadTask(q: string | null | undefined, hint?: string) {
  const text = q ? gapText(q, hint) : null
  useEffect(() => {
    if (!text || !getState().settings.speech) return
    const t = window.setTimeout(() => { void speakTask(text) }, 120)
    return () => window.clearTimeout(t)
  }, [text])
}

/** Gumb z zvočnikom ob nalogi: še enkrat prebere navodilo (kot pri Duolingu). */
export function TaskSay({ q, hint }: { q: string | null | undefined; hint?: string }) {
  const text = q ? gapText(q, hint) : null
  if (!text) return null
  return <button type="button" className="say-btn" onClick={() => void speakTask(text)} aria-label="Preberi nalogo"><Volume2 /></button>
}
