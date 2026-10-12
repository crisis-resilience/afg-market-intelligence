import type { ScoreBreakdown } from './types'

// The eight factors of the opportunity score, with their weights (mirrors
// OPPORTUNITY_SCORE_WEIGHTS in config.py). `short` labels fit the market
// cards; `label` is used where there is room.
export const SCORE_DIMENSIONS: {
  key: keyof ScoreBreakdown
  short: string
  label: string
  weight: number
}[] = [
  { key: 'market_size', short: 'Market size', label: 'Market size', weight: 0.2 },
  { key: 'market_growth', short: 'Market growth', label: 'Market growth', weight: 0.18 },
  { key: 'market_quality', short: 'Market quality', label: 'Market quality', weight: 0.13 },
  { key: 'price_competitiveness', short: 'Price', label: 'Price competitiveness', weight: 0.13 },
  { key: 'tariff', short: 'Tariff', label: 'Tariff rate', weight: 0.12 },
  { key: 'afg_foothold', short: 'Afghan foothold', label: 'Afghan foothold', weight: 0.1 },
  { key: 'distance', short: 'Proximity', label: 'Geographic proximity', weight: 0.1 },
  { key: 'language', short: 'Language', label: 'Language similarity', weight: 0.04 },
]
