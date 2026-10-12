import { scoreBg, formatScore } from '@/lib/utils'

export default function ScoreBadge({ score }: { score: number | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono text-[15px] font-medium tabular-nums px-3 py-[5px] min-w-11 ${scoreBg(score)}`}
    >
      {formatScore(score)}
    </span>
  )
}
