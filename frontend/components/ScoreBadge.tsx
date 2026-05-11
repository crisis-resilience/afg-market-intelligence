import { scoreBg, formatScore } from '@/lib/utils'

export default function ScoreBadge({
  score,
  size = 'md',
}: {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = {
    sm: 'text-xs px-2 py-0.5 min-w-[2.5rem]',
    md: 'text-sm px-2.5 py-1 min-w-[3rem]',
    lg: 'text-xl font-bold px-4 py-2 min-w-[4rem]',
  }[size]

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${scoreBg(score)} ${sizeClass}`}
    >
      {formatScore(score)}
    </span>
  )
}
