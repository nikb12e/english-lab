// Pisne naloge po vzoru Mock testa (6: opis osebe, 7: počitnice v 5 do 10 povedih) in učnih listov.
import type { WriteCard } from './types'

const W = (id: string, q: string, brief: string, min = 5, max = 10): WriteCard => ({ id: 'w_' + id, kind: 'write', q, brief, min, max, sec: 'v_write' })

export const WRITE_CARDS: WriteCard[] = [
  W('planning', 'How can good planning improve a holiday? Write 5 to 10 sentences.', 'Naloga 7 z Mock testa. Omeni rezervacijo, nastanitev, prevoz, prtljago, zavarovanje in kaj gre lahko narobe brez načrta.'),
  W('person1', 'Describe this person’s appearance and character: a woman in her forties, tall and slim, with shoulder-length curly ginger hair, freckles and a pale complexion. She is always smartly dressed, she never forgets anything and she always helps her neighbours.', 'Naloga 6 z Mock testa (namesto slike opis). Uporabi besedišče za obraz, lase, postavo, oblačila in osebnostne lastnosti.', 6, 10),
  W('person2', 'Describe this person’s appearance and character: a middle-aged man, stocky and a bit plump, with a receding hairline, grey stubble and a round face. He wears scruffy, worn-out jeans, he is a bit moody in the mornings but very generous and down-to-earth.', 'Naloga 6 z Mock testa. Opiši videz in značaj; uporabi vsaj tri pridevnike z učnega lista Personality.', 6, 10),
  W('person3', 'Describe a member of your family or a close friend: appearance, clothes and character. Give an example of their behaviour for each character trait.', 'Opis osebe kot na testu. Za vsako lastnost dodaj primer vedenja.', 6, 10),
  W('lastholiday', 'Talk about your last holiday: where you went, how you travelled, where you stayed, what you did and what went wrong.', 'Uporabi besede z lista Travel, holidays: set off, held up, en route, half board, sightseeing, excursion.', 6, 10),
  W('accommodation', 'Compare two types of holiday accommodation (for example a self-catering apartment and an all-inclusive hotel). Which would you choose and why?', 'Uporabi besedišče nastanitev in utemelji izbiro.', 5, 8),
  W('problems', 'Describe a journey where something went wrong (a delay, lost luggage, a puncture, seasickness…). What happened and how did you solve it?', 'Uporabi preteklik in besede za težave na potovanju.', 5, 9),
  W('place', 'Write a short advertisement for a place to visit in Slovenia, like the texts on the handout “Places to visit”. Use at least five descriptive adjectives.', 'Kot oglasi na učnem listu Places to visit: sandy, peaceful, breathtaking, cosy, lively …', 5, 8),
  W('ideal', 'Describe your ideal travel companion: what should they look like on a trip, and what personality traits are important? What would annoy you?', 'Uporabi pridevnike osebnosti in njihova nasprotja.', 5, 9),
  W('packing', 'You are going on a hiking holiday in the mountains. What will you pack and why? What will you wear?', 'Oblačila, materiali in oprema z učnega lista Places to visit (equipment).', 5, 8),
]
