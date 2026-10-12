import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDiscoveryResult } from '@/lib/api'
import { formatPct } from '@/lib/utils'
import { SCORE_DIMENSIONS } from '@/lib/scoring'
import ScoreBadge from '@/components/ScoreBadge'
import ScoreBar from '@/components/ScoreBar'
import { Breadcrumb, PortPhoto, ToolSteps } from '@/components/ToolChrome'

export default async function DiscoverPage(props: PageProps<'/discover/[hs_code]'>) {
  const { hs_code } = await props.params
  const searchParams = await props.searchParams
  const minScore = searchParams?.min_score ? Number(searchParams.min_score) : undefined

  const result = await getDiscoveryResult(hs_code, minScore)
  if (!result) notFound()

  const productName = result.product_name ?? `HS ${result.hs_code}`

  return (
    <>
      <ToolSteps current={2} links={['/']} />

      {/* Photo banner: title, filter and legend; the market cards overlap its bottom edge */}
      <section className="relative overflow-hidden bg-ink pb-[100px]">
        <PortPhoto />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16">
          <div className="pt-12 pb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-12">
            <div className="flex flex-col gap-3 max-w-[760px]">
              <Breadcrumb trail={[{ label: 'Find your market', href: '/' }, { label: productName }]} />
              <h1 className="on-photo-strong text-[34px] sm:text-[44px] font-semibold tracking-[-0.028em] leading-[1.08] m-0 text-white">
                {productName}
              </h1>
              <p className="on-photo font-mono text-[15px] text-white m-0">
                HS {result.hs_code} · {result.total_markets_scored} markets scored · {result.computed_for_year}
              </p>
            </div>
            <MinScoreFilter current={minScore} hsCode={hs_code} />
          </div>
          <div className="on-photo pb-4 flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13px] text-white">
            <LegendDot className="bg-score-high" label="70+ High" />
            <LegendDot className="bg-score-mid" label="40–70 Moderate" />
            <LegendDot className="bg-score-low" label="Under 40 Low" />
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-20">
        {result.markets.length === 0 ? (
          <p className="bg-white border border-line rounded-md p-12 text-center text-muted text-[15px] m-0">
            No markets match your filter. Try lowering the minimum score.
          </p>
        ) : (
          <ol className="flex flex-col gap-3.5 list-none m-0 p-0">
            {result.markets.map((market) => (
                <li
                  key={market.market_code}
                  className="bg-white border border-line rounded-md px-6 py-[22px] flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-9"
                >
                  {/* Rank, name, score + two key figures. Kept short on purpose:
                      the full figures are on the market profile. */}
                  <div className="lg:w-[300px] shrink-0 flex flex-col gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="w-[22px] text-right font-mono text-[22px] font-medium text-grey">{market.rank}</span>
                      <h2 className="flex-1 min-w-0 text-[17px] font-semibold m-0 truncate">{market.market_name ?? market.market_code}</h2>
                      <ScoreBadge score={market.opportunity_score} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 pl-9 m-0">
                      <Metric
                        label="Average yearly growth"
                        value={formatPct(market.cagr_pct)}
                        title="Average yearly growth of this market's imports of the product, over recent years"
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
                      href={`/discover/${hs_code}/markets/${market.market_code}`}
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

function MinScoreFilter({ current, hsCode }: { current?: number; hsCode: string }) {
  const options = [
    { label: 'All markets', value: undefined },
    { label: 'Score ≥ 40', value: 40 },
    { label: 'Score ≥ 60', value: 60 },
    { label: 'Score ≥ 70', value: 70 },
  ]
  return (
    <div className="flex flex-col lg:items-end gap-2.5 shrink-0">
      <span className="on-photo text-xs font-semibold tracking-[0.06em] uppercase text-white">Show</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = (opt.value ?? 0) === (current ?? 0)
          const href = opt.value ? `/discover/${hsCode}?min_score=${opt.value}` : `/discover/${hsCode}`
          return (
            <Link
              key={opt.label}
              href={href}
              aria-current={isActive ? 'true' : undefined}
              className={`text-sm px-4 py-2 rounded-full border no-underline ${
                isActive
                  ? 'bg-undp border-undp text-white font-medium'
                  : 'bg-white border-line text-muted hover:border-undp hover:text-undp'
              }`}
            >
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
