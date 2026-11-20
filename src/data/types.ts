export type TopicId = 'verbs' | 'present' | 'articles' | 'nouns' | 'vocab'

/** Vtipkaš odgovor. Sprejeti so vsi nizi v `a`. */
export interface TypeCard { id: string; kind: 'type'; q: string; a: string[]; hint?: string; note?: string; sec?: string; /** id slike iz pictures.ts (naloga Poimenuj sliko) */ img?: string; /** začetna težavnost 0 do 3 */ diff?: number }
/** Izbereš enega od odgovorov. */
export interface ChoiceCard { id: string; kind: 'choice'; q: string; options: string[]; correct: number; note?: string; sec?: string }
/** Razloži v angleščini; oceni jezikovni model. `a` je vzorčna razlaga. */
export interface ExplainCard { id: string; kind: 'explain'; q: string; a: string; note?: string; sec?: string }
/** Pisni sestavek (kot nalogi 6 in 7 na Mock testu); oceni jezikovni model po merilih. */
export interface WriteCard { id: string; kind: 'write'; q: string; brief: string; min: number; max: number; note?: string; sec?: string }
export type Card = TypeCard | ChoiceCard | ExplainCard | WriteCard

export interface Deck { id: TopicId; title: string; short: string; source: string; cards: Card[] }

export interface Topic { id: TopicId; name: string; desc: string }
export const TOPICS: Topic[] = [
  { id: 'verbs', name: 'Nepravilni glagoli', desc: '196 glagolov, vsi z lista za test' },
  { id: 'present', name: 'Present simple in continuous', desc: 'Raba, glagoli stanja, pravopis' },
  { id: 'articles', name: 'Členi', desc: 'a, an, the ali brez člena' },
  { id: 'nouns', name: 'Samostalniki', desc: 'Števni, neštevni, nepravilna množina' },
  { id: 'vocab', name: 'Besedišče za test', desc: 'Videz, oblačila, osebnost, potovanja, idiomi' },
]
