// Writing tasks modelled on the Mock test (6: describing a person, 7: a holiday in 5 to 10 sentences) and the worksheets.
import type { WriteCard } from './types'

const W = (id: string, q: string, brief: string, min = 5, max = 10): WriteCard => ({ id: 'w_' + id, kind: 'write', q, brief, min, max, sec: 'v_write' })

export const WRITE_CARDS: WriteCard[] = [
  W('planning', 'How can good planning improve a holiday? Write 5 to 10 sentences.', 'Task 7 of the mock test. Mention booking, accommodation, transport, luggage, insurance and what can go wrong without a plan.'),
  W('person1', 'Describe this person’s appearance and character: a woman in her forties, tall and slim, with shoulder-length curly ginger hair, freckles and a pale complexion. She is always smartly dressed, she never forgets anything and she always helps her neighbours.', 'Task 6 of the mock test (a description instead of a picture). Use vocabulary for the face, hair, build, clothes and personality.', 6, 10),
  W('person2', 'Describe this person’s appearance and character: a middle-aged man, stocky and a bit plump, with a receding hairline, grey stubble and a round face. He wears scruffy, worn-out jeans, he is a bit moody in the mornings but very generous and down-to-earth.', 'Task 6 of the mock test. Describe appearance and character; use at least three adjectives from the Personality worksheet.', 6, 10),
  W('person3', 'Describe a member of your family or a close friend: appearance, clothes and character. Give an example of their behaviour for each character trait.', 'Describing a person like on the test. Add an example of behaviour for every trait.', 6, 10),
  W('lastholiday', 'Talk about your last holiday: where you went, how you travelled, where you stayed, what you did and what went wrong.', 'Use words from the Travel, holidays list: set off, held up, en route, half board, sightseeing, excursion.', 6, 10),
  W('accommodation', 'Compare two types of holiday accommodation (for example a self-catering apartment and an all-inclusive hotel). Which would you choose and why?', 'Use accommodation vocabulary and explain your choice.', 5, 8),
  W('problems', 'Describe a journey where something went wrong (a delay, lost luggage, a puncture, seasickness…). What happened and how did you solve it?', 'Use the past tense and words for problems on a journey.', 5, 9),
  W('place', 'Write a short advertisement for a place to visit in Slovenia, like the texts on the handout “Places to visit”. Use at least five descriptive adjectives.', 'Like the adverts on the Places to visit worksheet: sandy, peaceful, breathtaking, cosy, lively …', 5, 8),
  W('ideal', 'Describe your ideal travel companion: what should they look like on a trip, and what personality traits are important? What would annoy you?', 'Use personality adjectives and their opposites.', 5, 9),
  W('packing', 'You are going on a hiking holiday in the mountains. What will you pack and why? What will you wear?', 'Clothes, materials and equipment from the Places to visit worksheet (equipment).', 5, 8),
]
