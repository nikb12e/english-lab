export type TopicId = 'verbs' | 'present' | 'articles' | 'nouns' | 'vocab'

/** You type the answer. All strings in `a` are accepted. */
export interface TypeCard { id: string; kind: 'type'; q: string; a: string[]; hint?: string; note?: string; sec?: string; /** picture id from pictures.ts (Name the picture task) */ img?: string; /** starting difficulty 0 to 3 */ diff?: number }
/** You pick one of the answers. */
export interface ChoiceCard { id: string; kind: 'choice'; q: string; options: string[]; correct: number; note?: string; sec?: string }
/** Explain in English; graded by the language model. `a` is a model explanation. */
export interface ExplainCard { id: string; kind: 'explain'; q: string; a: string; note?: string; sec?: string }
/** Written composition (like tasks 6 and 7 on the Mock test); graded by the language model against criteria. */
export interface WriteCard { id: string; kind: 'write'; q: string; brief: string; min: number; max: number; note?: string; sec?: string }
export type Card = TypeCard | ChoiceCard | ExplainCard | WriteCard

export interface Deck { id: TopicId; title: string; short: string; source: string; cards: Card[] }

export interface Topic { id: TopicId; name: string; desc: string }
export const TOPICS: Topic[] = [
  { id: 'verbs', name: 'Irregular verbs', desc: '196 verbs, all from the test list' },
  { id: 'present', name: 'Present simple and continuous', desc: 'Use, state verbs, spelling' },
  { id: 'articles', name: 'Articles', desc: 'a, an, the or no article' },
  { id: 'nouns', name: 'Nouns', desc: 'Countable, uncountable, irregular plurals' },
  { id: 'vocab', name: 'Test vocabulary', desc: 'Appearance, clothes, personality, travel, idioms' },
]
