import { scoreBarColor, scoreColor } from '@/lib/utils'

interface ScoreBarProps {
  label: string
  score: number | null | undefined
  weight?: number
  /** Width of the label column in px (the market cards and the profile differ). */
  labelWidth?: number
  // Overrides the displayed number (e.g. a raw "12.0%" tariff rate instead
  // of the abstract 0-100 score) while the bar's fill width/color still
  // follow `score` -- score is always oriented "higher is better" (for
  // tariff, a low rate produces a high score), so reusing it keeps this
  // bar visually comparable to the other dimensions on the same 0-100
  // scale, and keeps the color correctly "low tariff = green" without a
  // separate, inverted color rule.
  displayValue?: string
}

export default function ScoreBar({ label, score, weight, labelWidth = 118, displayValue }: ScoreBarProps) {
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0
  const hasData = score != null

  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="text-muted shrink-0 truncate" style={{ width: labelWidth }}>
        {label}
      </span>
      <div className="flex-1 h-2 bg-soft rounded-full overflow-hidden">
        {hasData && (
          <div className={`h-full rounded-full ${scoreBarColor(score)} transition-all duration-500`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className={`w-[46px] shrink-0 text-right font-mono text-[12.5px] font-medium tabular-nums ${hasData ? scoreColor(score) : 'text-muted'}`}>
        {hasData ? (displayValue ?? Math.round(pct)) : '—'}
      </span>
      {weight != null && (
        <span className="w-[34px] shrink-0 text-right font-mono text-[11.5px] text-grey">{(weight * 100).toFixed(0)}%</span>
      )}
    </div>
  )
}
