// Klici jezikovnega modela (GPT-6 Luna prek strežniške funkcije »ai«). Vse je neobvezno: brez prijave ali povezave
// aplikacija dela naprej z vnaprej pripravljenimi nalogami in razlagami.
import { supabase } from './supabase'

let down = 0
async function call<T>(body: Record<string, unknown>, timeoutMs = 9000): Promise<T | null> {
  if (Date.now() < down) return null
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) return null
  try {
    const res = await Promise.race([
      supabase.functions.invoke('ai', { body }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ])
    if (!res) return null
    if (res.error) { down = Date.now() + 2 * 60_000; return null }
    return res.data as T
  } catch {
    down = Date.now() + 2 * 60_000
    return null
  }
}

export const aiAvailable = async () => !!(await supabase.auth.getSession()).data.session && Date.now() >= down

export interface Grading { score: 0 | 1 | 2; feedback: string; better: string }
/** Oceni razlago v angleščini (naloga »Explain in English«). */
export const gradeExplain = (term: string, model: string, answer: string) =>
  call<Grading>({ action: 'grade', term, model, answer })

/** Kratka razlaga napake v slovenščini, prilagojena odgovoru, ki ga je dal učenec. */
export const explainMistake = (task: string, given: string, correct: string, ctx = '') =>
  call<{ text: string }>({ action: 'why', task, given, correct, ctx }, 12000)

export interface GenItem { kind: 'type' | 'choice'; q: string; a?: string[]; options?: string[]; correct?: number; hint?: string; note?: string; diff?: number }
/** Nove testne naloge za izbrano skupino (sveže, iz predpomnilnika na strežniku ali na novo ustvarjene). */
export const freshItems = (sec: string, exclude: string[], fresh = false) =>
  call<{ items: GenItem[] }>({ action: 'quiz', sec, exclude: exclude.slice(-300), fresh }, 30000)

export interface WriteGrade { score: number; content: string; vocab: string; grammar: string; fixes: { wrong: string; right: string; why: string }[]; better: string }
/** Oceni pisni sestavek po merilih s testa (vsebina, besedišče, slovnica), 0 do 10 točk, s popravki. */
export const gradeWriting = (task: string, brief: string, text: string) =>
  call<WriteGrade>({ action: 'write', task, brief, text }, 30000)

export interface Diag { accept: number; kind: 'typo' | 'form' | 'near' | 'wrong' | 'other' | string; conf: number }
/** Jev (odločitveni model) presodi vpisani odgovor: je sprejemljiv (sinonim, različica) in kakšne vrste je napaka. ~0,2 s. */
export const diagnose = (task: string, expected: string[], given: string) =>
  call<Diag>({ action: 'diag', task, expected, given }, 6000)
