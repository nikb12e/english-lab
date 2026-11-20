import { useState } from 'react'
import { VERBS } from '../lib/verbs'
import { maturity, type MemState } from '../lib/fsrs'

// The verb sheet as a grid: 178 squares in the same order as on the printed verb list.
// Colour = how well you know the verb (from light grey to ballpoint blue), red outline = due for review.
export function Grid178({ items, onSelect }: { items: Record<string, MemState>; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const now = Date.now()
  return (
    <div className="grid178-wrap">
      <div className="grid178" role="list" aria-label={`All ${VERBS.length} verbs`}>
        {VERBS.map((v, i) => {
          const c = items['v:' + v.id]
          const m = maturity(c)
          const due = !!c?.reps && c.due <= now
          return (
            <button
              key={v.id}
              style={{ ['--i' as string]: i }}
              role="listitem"
              className={'cell ' + m + (due ? ' due' : '')}
              aria-label={`${v.id}, ${v.slo}`}
              title={`${v.id} · ${v.slo}`}
              onPointerEnter={() => setHover(v.id)}
              onPointerLeave={() => setHover((h) => (h === v.id ? null : h))}
              onClick={() => onSelect(v.id)}
            />
          )
        })}
      </div>
      <div className="grid178-hover" aria-hidden="true">{hover ? <><b>{hover}</b> {VERBS.find((v) => v.id === hover)?.slo}</> : ' '}</div>
    </div>
  )
}
