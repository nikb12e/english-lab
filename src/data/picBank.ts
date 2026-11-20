// “Name the picture” cards and crossword clues. All words and clues come from the English worksheets.
import type { TypeCard } from './types'
import { PICS, type Pic } from './pictures'

/** starting difficulty (0 easy … 3 hard); the algorithm then adjusts the real difficulty for you */
const HARD = new Set(['stubble', 'receding-hair', 'waistcoat', 'tights', 'upturned-nose', 'puncture', 'polo-neck', 'mittens', 'flared-trousers', 'baggy-trousers', 'platform-shoes', 'knee-length-skirt', 'dressing-gown', 'sweat-jacket', 'sweatpants', 'gas-stove', 'mosquito-repellent', 'lorry', 'double-decker', 'twin-room', 'thumbs', 'heel', 'plump', 'lungs'])
const MED = new Set(['blouse', 'cardigan', 'collar', 'zip', 'freckles', 'ginger', 'moustache', 'oval-face', 'round-face', 'skinny', 'cheek', 'eyebrows', 'toes', 'knee', 'flippers', 'goggles', 'sleeping-bag', 'swimming-costume', 'suntan-lotion', 'first-aid-kit', 'ferry', 'tram', 'steering-wheel', 'tyre', 'fishing-boat', 'petrol-station', 'jet', 'traffic-jam', 'boarding-card', 'balcony', 'double-room', 'backpacker', 'desert-island', 'snow-capped-mountain', 'ruins', 'striped', 'checked', 'floral', 'plain', 'tracksuit', 'polo-shirt', 'short-sleeved-shirt', 'running-shoes'])
export const picDiff = (p: Pic) => (HARD.has(p.id) ? 2.5 : MED.has(p.id) ? 1.5 : 0.6)

/** pattern for the hint: s_______ b__ (8, 3) */
export function pattern(w: string) {
  const parts = w.split(/([ -])/)
  const shown = parts.map((p) => (p === ' ' || p === '-' ? p : p[0] + '_'.repeat(Math.max(0, p.length - 1)))).join('')
  const lens = w.split(/[ -]/).map((p) => p.length).join(', ')
  return `${shown} (${lens})`
}

export const PIC_CARDS: TypeCard[] = PICS.map((p) => ({
  id: 'pic_' + p.id,
  kind: 'type',
  q: 'What is this called in English?',
  a: p.en,
  hint: pattern(p.en[0]),
  note: `${p.en[0]} in Slovenian: “${p.slo}”. Source: ${p.src}.`,
  sec: 'v_pic',
  img: p.id,
  diff: picDiff(p),
}))

/** Text clues for the crossword, word for word from the worksheets (definitions and gap fills). */
export interface Clue { a: string; clue: string; src: string }
export const TEXT_CLUES: Clue[] = [
  // Mock test 1, task 1 (crossword) and 5
  { a: 'book', clue: 'reserve a holiday', src: 'Mock test 1' },
  { a: 'scruffy', clue: 'untidy appearance', src: 'Mock test 1' },
  { a: 'cruise', clue: 'holiday at sea', src: 'Mock test 1' },
  { a: 'skinny', clue: 'very thin (person)', src: 'Mock test 1' },
  { a: 'heel', clue: 'back of the foot', src: 'Mock test 1' },
  { a: 'delay', clue: 'cause a journey to be late', src: 'Mock test 1' },
  { a: 'breathe', clue: 'take air in and out', src: 'Mock test 1' },
  { a: 'jumper', clue: 'warm woollen top', src: 'Mock test 1' },
  { a: 'moody', clue: 'often changing her mood', src: 'Mock test 1' },
  { a: 'draughty', clue: 'a cottage letting in cold air', src: 'Mock test 1' },
  { a: 'backpackers', clue: 'budget travellers with rucksacks', src: 'Mock test 1' },
  { a: 'sensible', clue: 'practical and wise', src: 'Mock test 1' },
  { a: 'gear', clue: 'the necessary equipment for a trip', src: 'Mock test 1' },
  // Travel, holidays
  { a: 'globetrotter', clue: 'someone who has visited every country on earth', src: 'Travel, holidays (list 1)' },
  { a: 'pilgrims', clue: 'they make journeys to holy places for religious reasons', src: 'Travel, holidays (list 1)' },
  { a: 'explorers', clue: 'they travel to places about which little is known', src: 'Travel, holidays (list 1)' },
  { a: 'stopover', clue: 'no direct flight: a short stay in Rome to change planes', src: 'Travel, holidays (list 1)' },
  { a: 'beach', clue: 'clean, sandy, dirty, secluded …', src: 'Travel, holidays (list 2)' },
  { a: 'shop', clue: 'trendy, expensive, second-hand, souvenir …', src: 'Travel, holidays (list 2)' },
  { a: 'street', clue: 'narrow, busy, winding, cobbled …', src: 'Travel, holidays (list 2)' },
  { a: 'hotel', clue: 'luxury, family, five-star, Victorian …', src: 'Travel, holidays (list 2)' },
  { a: 'cuisine', clue: 'delicious, local, gourmet …', src: 'Travel, holidays (list 2)' },
  { a: 'island', clue: 'exotic, tropical, desert …', src: 'Travel, holidays (list 2)' },
  { a: 'shade', clue: 'sit in the … rather than directly in the sun', src: 'Travel, holidays (list 2)' },
  { a: 'sunbathe', clue: 'lie in the sun to get a tan', src: 'Travel, holidays (list 2)' },
  { a: 'jetlag', clue: 'tiredness after a long flight across time zones', src: 'Travel, holidays (list 2)' },
  { a: 'seasickness', clue: 'feeling ill on a ship', src: 'Travel, holidays (list 2)' },
  { a: 'detour', clue: 'a longer way round when the road is closed', src: 'Travel, holidays (list 2)' },
  // Places to visit
  { a: 'metropolis', clue: 'a large capital city', src: 'Places to visit' },
  { a: 'explore', clue: 'look around (the woods behind the hotel)', src: 'Places to visit' },
  { a: 'restore', clue: 'repair (an old church)', src: 'Places to visit' },
  { a: 'transform', clue: 'change (an old building into a museum)', src: 'Places to visit' },
  { a: 'lively', clue: 'interesting, exciting (pubs and clubs)', src: 'Places to visit' },
  { a: 'exclusive', clue: 'restricted to certain people', src: 'Places to visit' },
  { a: 'cloudless', clue: 'clear (skies)', src: 'Places to visit' },
  { a: 'overpriced', clue: 'too expensive (hotels)', src: 'Places to visit' },
  { a: 'peaceful', clue: 'quiet (seafront)', src: 'Places to visit' },
  { a: 'spacious', clue: 'large (rooms)', src: 'Places to visit' },
  { a: 'delicious', clue: 'tasty (cuisine)', src: 'Places to visit' },
  { a: 'welcoming', clue: 'friendly (surroundings)', src: 'Places to visit' },
  { a: 'endless', clue: 'very long (rivers)', src: 'Places to visit' },
  { a: 'bottomless', clue: 'very deep (lakes)', src: 'Places to visit' },
  { a: 'towering', clue: 'very tall (mountains)', src: 'Places to visit' },
  { a: 'vast', clue: 'very big (areas)', src: 'Places to visit' },
  { a: 'unpolluted', clue: 'clean (water)', src: 'Places to visit' },
  // Personality
  { a: 'impatient', clue: 'Hurry up! Oh, don’t be so I…', src: 'Personality' },
  { a: 'nosy', clue: 'How much do you earn? Don’t be so N…', src: 'Personality' },
  { a: 'childish', clue: 'I’m not doing the washing-up! Don’t be so C…', src: 'Personality' },
  { a: 'pessimistic', clue: 'I know I won’t get this job. Don’t be so P…', src: 'Personality' },
  { a: 'generous', clue: 'It was very G… of you to pay for all the drinks', src: 'Personality' },
  { a: 'careless', clue: 'I locked my keys in the house. What a C… thing to do!', src: 'Personality' },
  { a: 'pushy', clue: 'trying to persuade someone to give up her job', src: 'Personality' },
  { a: 'fussy', clue: 'she has seen 30 flats and liked none of them', src: 'Personality' },
  { a: 'pretentious', clue: 'trying to look more important than you are', src: 'Personality' },
  { a: 'assertive', clue: 'a bold and confident leader', src: 'Personality' },
  // Appearance
  { a: 'bald', clue: 'receding hair: going …', src: 'Appearance' },
  { a: 'comb', clue: 'what you do to your hair', src: 'Appearance' },
  { a: 'fold', clue: 'what you do with your arms', src: 'Appearance' },
  { a: 'bend', clue: 'what you do with your knees', src: 'Appearance' },
  { a: 'complexion', clue: 'the natural colour of the skin on your face', src: 'Appearance' },
]
