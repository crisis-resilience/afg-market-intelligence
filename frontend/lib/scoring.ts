import type { ScoreBreakdown } from './types'

// The eight factors of the opportunity score. `short` labels fit the market
// cards; `label` is used where there is room. The order is also the order of
// the digits in the `w` URL parameter (see importanceParam), so only append.
export const SCORE_DIMENSIONS: {
  key: keyof ScoreBreakdown
  short: string
  label: string
}[] = [
  { key: 'market_size', short: 'Market size', label: 'Market size' },
  { key: 'market_growth', short: 'Market growth', label: 'Market growth' },
  { key: 'market_quality', short: 'Market quality', label: 'Market quality' },
  { key: 'price_competitiveness', short: 'Price', label: 'Price competitiveness' },
  { key: 'tariff', short: 'Tariff', label: 'Tariff rate' },
  { key: 'afg_foothold', short: 'Afghan foothold', label: 'Afghan foothold' },
  { key: 'distance', short: 'Proximity', label: 'Geographic proximity' },
  { key: 'language', short: 'Language', label: 'Language similarity' },
]

// How much the user says each factor matters. A factor's weight is its level
// divided by the sum of the levels, so "Very important" counts 1.5x
// "Important" and "Ignore" leaves the factor out. The default (all
// "Important") is equal weights, the same as config.OPPORTUNITY_SCORE_WEIGHTS
// that the ETL's stored opportunity_score uses; keep the two in step.
export const IMPORTANCE_LEVELS = ['Ignore', 'Less important', 'Important', 'Very important'] as const
export const DEFAULT_IMPORTANCE = 2

export type Importance = Record<keyof ScoreBreakdown, number>

/** Every factor "Important": equal weights, the default ranking. */
export function defaultImportance(): Importance {
  return Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d.key, DEFAULT_IMPORTANCE])) as Importance
}

export function isDefaultImportance(importance: Importance): boolean {
  return SCORE_DIMENSIONS.every((d) => importance[d.key] === DEFAULT_IMPORTANCE)
}

/** The `w` URL parameter: one digit (0-3) per factor, in SCORE_DIMENSIONS order. Null for the default. */
export function importanceParam(importance: Importance): string | null {
  if (isDefaultImportance(importance)) return null
  return SCORE_DIMENSIONS.map((d) => importance[d.key]).join('')
}

/** Reads the `w` URL parameter; anything malformed falls back to the default. */
export function parseImportance(param: string | string[] | null | undefined): Importance {
  const value = Array.isArray(param) ? param[0] : param
  if (!value || !new RegExp(`^[0-3]{${SCORE_DIMENSIONS.length}}$`).test(value)) return defaultImportance()
  return Object.fromEntries(SCORE_DIMENSIONS.map((d, i) => [d.key, Number(value[i])])) as Importance
}

/**
 * A factor's share as a percentage, rounded to a whole number ("17%", "11%")
 * -- except exact halves, which stay as they are, so the default equal share
 * reads 12.5% rather than eight factors at 13%.
 */
export function formatShare(share: number): string {
  const pct = share * 100
  const half = Math.round(pct * 2) / 2
  const isExactHalf = Math.abs(pct - half) < 1e-9 && !Number.isInteger(half)
  return `${isExactHalf ? half : Math.round(pct)}%`
}

/** Appends the `w` parameter to a link when the weights aren't the default. */
export function withImportance(href: string, importance: Importance): string {
  const w = importanceParam(importance)
  return w ? `${href}${href.includes('?') ? '&' : '?'}w=${w}` : href
}

/**
 * Each factor's share of one market's score (0-1). A factor the market has
 * no data for is left out and its share spread over the others -- the same
 * rule the ETL used for the stored score (see the "Missing-Data Handling"
 * column of docs/INDICATOR_INVENTORY.xlsx). Ignored factors get no share.
 */
export function factorWeights(breakdown: ScoreBreakdown, importance: Importance): Partial<Record<keyof ScoreBreakdown, number>> {
  const counted = SCORE_DIMENSIONS.filter((d) => breakdown[d.key] != null && importance[d.key] > 0)
  const total = counted.reduce((sum, d) => sum + importance[d.key], 0)
  return Object.fromEntries(counted.map((d) => [d.key, importance[d.key] / total]))
}

/** The 0-100 opportunity score for one market under the given importance levels. */
export function opportunityScore(breakdown: ScoreBreakdown, importance: Importance): number | null {
  const weights = factorWeights(breakdown, importance)
  const keys = Object.keys(weights) as (keyof ScoreBreakdown)[]
  if (keys.length === 0) return null
  return keys.reduce((sum, key) => sum + (breakdown[key] as number) * (weights[key] as number), 0)
}
