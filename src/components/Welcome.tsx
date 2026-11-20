// Brez prijave se ne rešuje: napredek, lestvica, glas in ocenjevanje z jezikovnim modelom so vezani na račun.
import { motion } from 'framer-motion'
import { SignIn } from './Account'

const POINTS: [string, string][] = [
  ['196 nepravilnih glagolov', 'vsi z lista za test, z izgovorjavo'],
  ['Preverjanje kot na testu', 'v zaporedju Mock testa, na koncu ocena'],
  ['Več vaje tam, kjer grešiš', 'algoritem sledi tvojim napakam in daje podobne naloge'],
  ['Učitelj AI', 'oceni razlage in sestavke ter pove, zakaj je narobe'],
]

export function Welcome() {
  return (
    <main className="shell welcome">
      <motion.div className="w-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
        <div className="w-logo" aria-hidden="true" />
        <h1 className="display">English Lab</h1>
        <p className="lead">Za vajo se prijavi. Tako se napredek shrani, algoritem si zapomni tvoje napake in tekmuješ na lestvici.</p>
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
