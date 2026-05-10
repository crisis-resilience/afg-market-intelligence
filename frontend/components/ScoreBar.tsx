import { scoreBarColor } from '@/lib/utils'

interface ScoreBarProps {
  label: string
  score: number | null | undefined
  weight?: number
}

export default function ScoreBar({ label, score, weight }: ScoreBarProps) {
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0
  const barColor = scoreBarColor(score)
  const hasData = score != null

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-36 text-gray-600 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        {hasData && (
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span className="w-8 text-right tabular-nums text-gray-500">
        {hasData ? Math.round(pct) : '—'}
      </span>
      {weight != null && (
        <span className="w-8 text-right text-gray-400 shrink-0">{(weight * 100).toFixed(0)}%</span>
      )}
    </div>
  )
}
