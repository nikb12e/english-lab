import { useState } from 'react'
import { VERBS } from '../lib/verbs'
import { maturity, type MemState } from '../lib/fsrs'

// List glagolov kot mreža: 178 kvadratkov v istem vrstnem redu kot na listu Gozdnega sklada.
// Barva = kako dobro glagol znaš (od svetlo sive do modrega kulija), rdeč rob = na vrsti za ponovitev.
export function Grid178({ items, onSelect }: { items: Record<string, MemState>; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const now = Date.now()
  return (
    <div className="grid178-wrap">
      <div className="grid178" role="list" aria-label={`Vseh ${VERBS.length} glagolov`}>
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
