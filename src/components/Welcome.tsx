// Not handled without sign in: progress, leaderboard, voice and grading with the language model are tied to an account.
import { motion } from 'framer-motion'
import { SignIn } from './Account'

const POINTS: [string, string][] = [
  ['196 irregular verbs', 'all from the test list, with pronunciation'],
  ['Test style check', 'in the order of the mock test, graded at the end'],
  ['More practice where you make mistakes', 'the algorithm follows your mistakes and gives you similar tasks'],
  ['AI teacher', 'grades explanations and essays and tells you why something is wrong'],
]

export function Welcome() {
  return (
    <main className="shell welcome">
      <motion.div className="w-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
        <div className="w-logo" aria-hidden="true" />
        <h1 className="display">English Lab</h1>
        <p className="lead">Sign in to practise. That way your progress is saved, the algorithm remembers your mistakes and you compete on the leaderboard.</p>
      </motion.div>
      <ul className="w-points">
        {POINTS.map(([t, d], i) => (
          <motion.li key={t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 28, delay: 0.1 + i * 0.07 }}>
            <b>{t}</b><span>{d}</span>
          </motion.li>
        ))}
      </ul>
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <SignIn compact />
      </motion.div>
    </main>
  )
}
