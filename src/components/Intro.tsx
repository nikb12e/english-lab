import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Uvod ob prvem odprtju v seji: glagol se pred tabo pregiba go → went → gone, nato se razpre v aplikacijo.
const WORDS = ['go', 'went', 'gone']

export function Intro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const ts = [
      setTimeout(() => setI(1), 620),
      setTimeout(() => setI(2), 1240),
      setTimeout(() => setLeaving(true), 1980),
      setTimeout(onDone, 2550),
    ]
    return () => ts.forEach(clearTimeout)
  }, [onDone])
  const w = WORDS[i]
  return (
    <motion.div className="intro" onClick={onDone} initial={{ opacity: 1 }} animate={leaving ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: 0.7, ease: 'easeOut' as const }}>
      <div className="intro-word" aria-label="go, went, gone">
        <AnimatePresence mode="popLayout" initial={true}>
          {w.split('').map((ch, k) => (
            <motion.span
              key={`${i}-${k}-${ch}`}
              className={i === 2 ? 'iri' : ''}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: 'easeOut' as const, delay: k * 0.04 }}
            >
              {ch}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <motion.div className="intro-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>English Lab</motion.div>
    </motion.div>
  )
}
