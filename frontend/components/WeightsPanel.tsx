'use client'

import { useState } from 'react'
import type { ScoreBreakdown } from '@/lib/types'
import { IMPORTANCE_LEVELS, SCORE_DIMENSIONS, formatShare, isDefaultImportance, type Importance } from '@/lib/scoring'

interface WeightsPanelProps {
  importance: Importance
  onChange: (key: keyof ScoreBreakdown, level: number) => void
  onReset: () => void
}

/**
 * One importance slider per factor (Ignore / Less important / Important /
 * Very important) instead of percentage sliders: percentages that must add
 * up to 100 push each other around, while a level per factor can be set on
 * its own. Each factor's resulting share is shown next to it.
 *
 * Open by default from lg up; on smaller screens it starts folded behind an
 * "Adjust" button so the market list stays near the top.
 */
export default function WeightsPanel({ importance, onChange, onReset }: WeightsPanelProps) {
  // null = not toggled yet: follow the breakpoint default (CSS below)
  const [open, setOpen] = useState<boolean | null>(null)
  const isDefault = isDefaultImportance(importance)
  const total = SCORE_DIMENSIONS.reduce((sum, d) => sum + importance[d.key], 0)

  const toggle = () => setOpen((prev) => !(prev ?? window.matchMedia('(min-width: 1024px)').matches))
  const bodyDisplay = open == null ? 'hidden lg:block' : open ? 'block' : 'hidden'

  return (
    <section aria-labelledby="weights-title" className="bg-white border border-line rounded-md px-6 py-5 mb-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h2 id="weights-title" className="text-[17px] font-semibold m-0">Customise the ranking and set your priorities</h2>
          <p className="text-[13px] text-muted m-0">
            {isDefault
              ? 'All eight factors count equally. Change how much each one matters and the ranking updates straight away.'
              : 'The ranking uses the importance you chose for each factor.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm px-4 py-2 rounded-full border border-line bg-white text-muted hover:border-undp hover:text-undp cursor-pointer"
            >
              Reset to equal
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open ?? undefined}
            aria-controls="weights-body"
            className="text-sm px-4 py-2 rounded-full border border-undp bg-white text-undp font-medium hover:bg-soft cursor-pointer"
          >
            {open == null ? (
              <>
                <span className="lg:hidden">Adjust</span>
                <span className="hidden lg:inline">Hide</span>
              </>
            ) : open ? 'Hide' : 'Adjust'}
          </button>
        </div>
      </div>

      <div id="weights-body" className={bodyDisplay}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3.5 pt-5">
          {SCORE_DIMENSIONS.map((dim) => {
            const level = importance[dim.key]
            const id = `weight-${dim.key}`
            return (
              <div key={dim.key} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 text-[13px]">
                <label htmlFor={id} className="w-full sm:w-[160px] shrink-0 font-medium">{dim.label}</label>
                <input
                  id={id}
                  type="range"
                  min={0}
                  max={IMPORTANCE_LEVELS.length - 1}
                  step={1}
                  value={level}
                  onChange={(e) => onChange(dim.key, Number(e.target.value))}
                  aria-valuetext={IMPORTANCE_LEVELS[level]}
                  className="flex-1 min-w-[120px] accent-undp cursor-pointer"
                />
                <span className={`w-[108px] shrink-0 ${level === 0 ? 'text-grey' : 'text-muted'}`}>{IMPORTANCE_LEVELS[level]}</span>
                <span className="w-[44px] shrink-0 text-right font-mono tabular-nums text-grey">
                  {total > 0 ? formatShare(level / total) : '—'}
                </span>
              </div>
            )
          })}
        </div>
        {total === 0 ? (
          <p className="text-[13px] text-danger mt-4 mb-0">Set at least one factor above “Ignore” to rank the markets.</p>
        ) : (
          <p className="text-xs text-muted mt-4 mb-0">
            When a market has no data for a factor, that factor’s share is spread over the others for that market.
          </p>
        )}
      </div>
    </section>
  )
}
