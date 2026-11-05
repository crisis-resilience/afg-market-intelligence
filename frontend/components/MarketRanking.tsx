'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { MarketOpportunity, ScoreBreakdown } from '@/lib/types'
import { formatPct } from '@/lib/utils'
import {
  SCORE_DIMENSIONS, defaultImportance, importanceParam, opportunityScore, withImportance, type Importance,
} from '@/lib/scoring'
import ScoreBadge from './ScoreBadge'
import ScoreBar from './ScoreBar'
import WeightsPanel from './WeightsPanel'

const MIN_SCORE_OPTIONS = [
  { label: 'All markets', value: undefined },
  { label: 'Score ≥ 40', value: 40 },
  { label: 'Score ≥ 60', value: 60 },
  { label: 'Score ≥ 70', value: 70 },
]

interface MarketRankingProps {
  hsCode: string
  markets: MarketOpportunity[]
  initialImportance: Importance
  initialMinScore?: number
  /** Server-rendered pieces of the banner: the photo and the title block. */
  photo: ReactNode
  heading: ReactNode
}

/**
 * The Compare-markets banner and list. Scores are recalculated here, in the
 * browser, from each market's eight factor scores and the importance the user
 * gives each factor -- so changing a weight re-ranks the markets instantly,
 * without a new request or ETL run. The stored opportunity_score isn't used.
 */
export default function MarketRanking({ hsCode, markets, initialImportance, initialMinScore, photo, heading }: MarketRankingProps) {
  const [importance, setImportance] = useState(initialImportance)
  const [minScore, setMinScore] = useState(initialMinScore)

  const ranked = useMemo(
    () =>
      markets
        .map((market) => ({ market, score: opportunityScore(market.score_breakdown, importance) }))
        // Highest first, markets with no score last; sort is stable, so ties keep the API's order
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .map((row, i) => ({ ...row, rank: i + 1 })),
    [markets, importance],
  )
  const shown = minScore ? ranked.filter((row) => row.score != null && row.score >= minScore) : ranked

  // Keep the choices in the URL, so a refresh, a shared link or the market
  // profile (which reads `w` too) shows the same ranking
  useEffect(() => {
    const params = new URLSearchParams()
    const w = importanceParam(importance)
    if (w) params.set('w', w)
    if (minScore) params.set('min_score', String(minScore))
    const query = params.toString()
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }, [importance, minScore])

  return (
    <>
      {/* Photo banner: title, filter and legend; the panel and market cards overlap its bottom edge */}
      <section className="relative overflow-hidden bg-ink pb-[100px]">
        {photo}
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16">
          <div className="pt-12 pb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-12">
            {heading}
            <MinScoreFilter current={minScore} onChange={setMinScore} />
          </div>
          <div className="on-photo pb-4 flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13px] text-white">
            <LegendDot className="bg-score-high" label="70+ High" />
            <LegendDot className="bg-score-mid" label="40–70 Moderate" />
            <LegendDot className="bg-score-low" label="Under 40 Low" />
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-20">
        <WeightsPanel
          importance={importance}
          onChange={(key: keyof ScoreBreakdown, level: number) => setImportance((prev) => ({ ...prev, [key]: level }))}
          onReset={() => setImportance(defaultImportance())}
        />

        {shown.length === 0 ? (
          <p className="bg-white border border-line rounded-md p-12 text-center text-muted text-[15px] m-0">
            No markets match your filter. Try lowering the minimum score.
          </p>
        ) : (
          <ol className="flex flex-col gap-3.5 list-none m-0 p-0">
            {shown.map(({ market, score, rank }) => (
              <li
                key={market.market_code}
                className="bg-white border border-line rounded-md px-6 py-[22px] flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-9"
              >
                {/* Rank, name, score + two key figures. Kept short on purpose:
                    the full figures are on the market profile. */}
                <div className="lg:w-[300px] shrink-0 flex flex-col gap-4">
                  <div className="flex items-center gap-3.5">
                    <span className="w-[22px] text-right font-mono text-[22px] font-medium text-grey">{rank}</span>
                    <h2 className="flex-1 min-w-0 text-[17px] font-semibold m-0 truncate">{market.market_name ?? market.market_code}</h2>
                    <ScoreBadge score={score} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 pl-9 m-0">
                    <Metric
                      label="Afghan export growth"
                      value={formatPct(market.cagr_pct)}
                      title="Average yearly growth of Afghanistan's exports of this product to this market, over recent years"
                    />
                    <Metric
                      label="Afghanistan’s share of imports"
                      value={formatPct(market.market_share_pct, 2, false)}
                      title="Share of this market's imports of the product that come from Afghanistan"
                    />
                  </dl>
                </div>

                {/* The eight score factors */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-9 gap-y-2.5">
                  {SCORE_DIMENSIONS.map((dim) => (
                    <ScoreBar
                      key={dim.key}
                      label={dim.short}
                      score={market.score_breakdown[dim.key]}
                      displayValue={
                        dim.key === 'tariff' && market.tariff_rate_pct != null
                          ? `${market.tariff_rate_pct.toFixed(1)}%`
                          : undefined
                      }
                    />
                  ))}
                </div>

                <div className="lg:w-[200px] shrink-0 flex lg:justify-end">
                  <Link
                    href={withImportance(`/discover/${hsCode}/markets/${market.market_code}`, importance)}
                    className="button-primary button-arrow"
                    aria-label={`Full profile: ${market.market_name ?? market.market_code}`}
                  >
                    Full profile
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span className={`w-[11px] h-[11px] rounded-full inline-block ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function Metric({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <div title={title}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono text-[13.5px] font-medium text-muted tabular-nums">{value}</dd>
    </div>
  )
}

function MinScoreFilter({ current, onChange }: { current?: number; onChange: (value?: number) => void }) {
  return (
    <div className="flex flex-col lg:items-end gap-2.5 shrink-0">
      <span className="on-photo text-xs font-semibold tracking-[0.06em] uppercase text-white">Show</span>
      <div className="flex flex-wrap gap-2">
        {MIN_SCORE_OPTIONS.map((opt) => {
          const isActive = (opt.value ?? 0) === (current ?? 0)
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              className={`text-sm px-4 py-2 rounded-full border cursor-pointer ${
                isActive
                  ? 'bg-undp border-undp text-white font-medium'
                  : 'bg-white border-line text-muted hover:border-undp hover:text-undp'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
