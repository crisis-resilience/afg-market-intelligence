export function formatUSD(value: number | null | undefined, compact = true): string {
  if (value == null) return '—'
  if (compact) {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPct(
  value: number | null | undefined,
  decimals = 1,
  showSign = true,
): string {
  if (value == null) return '—'
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatScore(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toFixed(1)
}

// Score scale used everywhere: high (70+), moderate (40–70), low (under 40).
export type ScoreLevel = 'high' | 'moderate' | 'low'

export function scoreLevel(score: number | null | undefined): ScoreLevel | null {
  if (score == null) return null
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

function byLevel(score: number | null | undefined, classes: Record<ScoreLevel, string>, none: string): string {
  const level = scoreLevel(score)
  return level ? classes[level] : none
}

/** Text colour for a score number. */
export function scoreColor(score: number | null | undefined): string {
  return byLevel(score, { high: 'text-green', moderate: 'text-amber-dark', low: 'text-danger' }, 'text-muted')
}

/** Background + text colour for a score badge. */
export function scoreBg(score: number | null | undefined): string {
  return byLevel(
    score,
    { high: 'bg-green-tint text-green', moderate: 'bg-amber-tint text-amber-dark', low: 'bg-danger-tint text-danger' },
    'bg-soft text-muted',
  )
}

/** Fill colour for a score bar. */
export function scoreBarColor(score: number | null | undefined): string {
  return byLevel(score, { high: 'bg-score-high', moderate: 'bg-score-mid', low: 'bg-score-low' }, 'bg-grey')
}

export function rankOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
