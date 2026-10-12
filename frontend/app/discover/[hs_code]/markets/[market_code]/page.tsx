import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getMarketProfile } from '@/lib/api'
import { formatUSD, formatPct, formatScore, scoreColor, scoreLevel } from '@/lib/utils'
import { SCORE_DIMENSIONS } from '@/lib/scoring'
import ScoreBar from '@/components/ScoreBar'
import NextSteps, { ExternalLink } from '@/components/NextSteps'
import InfoTooltip from '@/components/InfoTooltip'
import PriceComparison from '@/components/PriceComparison'
import { Breadcrumb, PortPhoto, ToolSteps } from '@/components/ToolChrome'
import {
  BarrierIcon, BarsIcon, DocumentIcon, ExportIcon, GlobeIcon, PodiumIcon, PriceTagIcon,
  ShareRing, ShieldIcon, TrendIcon, TruckIcon, WalletIcon,
} from '@/components/ProfileIcons'

// Display label per config.NATIVE_UNIT_PRICE_BASES value (falls back to the
// raw basis string for anything not listed, e.g. a future addition there).
const PRICE_BASIS_LABELS: Record<string, string> = {
  kg: 'kg',
  'm²': 'm²',
  u: 'piece',
}

// The tariff card is flagged "Main barrier" when the tariff factor scores
// this low on the 0–100 scale, i.e. it is pulling the opportunity score down.
const MAIN_BARRIER_BELOW = 40

// Border colour of the score box on the banner, by score level
const SCORE_ACCENT = { high: 'border-score-high', moderate: 'border-score-mid', low: 'border-score-low' } as const

const possessive = (name: string) => (name.endsWith('s') ? `${name}’` : `${name}’s`)

export default async function MarketProfilePage(
  props: PageProps<'/discover/[hs_code]/markets/[market_code]'>,
) {
  const { hs_code, market_code } = await props.params
  const profile = await getMarketProfile(hs_code, market_code)
  if (!profile) notFound()

  const market = profile.market_name ?? market_code
  const markets = possessive(market)
  const productName = profile.product_name ?? `HS ${hs_code}`
  const product = profile.product_name?.toLowerCase() ?? 'this product'
  const year = profile.computed_for_year
  const trade = profile.trade
  const ctx = profile.context
  const level = scoreLevel(profile.opportunity_score)

  // Trade figures fall back to this market's own most recent reported year
  // when computed_for_year's data hasn't landed at Comtrade yet -- each card
  // flags that year, so a lower score doesn't get mistaken for a weak market
  // when it's really just a reporting lag.
  const tradeYear = trade?.trade_data_year ?? null

  // Afghanistan can genuinely have zero recorded exports here for the
  // current trade_data_year (a real signal, not a data gap) -- when that
  // happens, surface the last year it did have any, purely for context.
  const showAfgLastExport = trade != null && trade.afg_export_value_usd == null && trade.afg_last_export_year != null

  const growthPeriod =
    trade?.growth.first_year != null && trade.growth.last_year != null
      ? `${trade.growth.first_year}–${trade.growth.last_year}`
      : null

  const price = trade?.price
  const unit = price?.price_basis ? (PRICE_BASIS_LABELS[price.price_basis] ?? price.price_basis) : null
  const hasPriceComparison = price?.unit_price_usd != null && price.market_avg_price_usd != null
  const gap = price?.price_vs_market_pct ?? null

  const tariffScore = profile.score_breakdown.tariff
  const tariffIsBarrier = tariffScore != null && tariffScore < MAIN_BARRIER_BELOW

  return (
    <>
      <ToolSteps current={3} links={['/', `/discover/${hs_code}`]} />

      {/* ── Title on the photo ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink min-h-[600px] pb-[330px]">
        <PortPhoto alt="Shipping containers stacked at a port" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pt-14 flex flex-col md:flex-row md:items-start justify-between gap-8 md:gap-12">
          <div className="flex flex-col gap-3 max-w-[760px]">
            <Breadcrumb
              trail={[
                { label: 'Find your market', href: '/' },
                { label: productName, href: `/discover/${hs_code}` },
                { label: market },
              ]}
            />
            <h1 className="on-photo-strong text-[40px] sm:text-[56px] font-semibold tracking-[-0.028em] leading-[1.05] m-0 text-white">
              {market}
            </h1>
            <p className="on-photo text-lg leading-[1.5] text-white m-0">
              {productName} · <span className="font-mono text-base">HS {hs_code}</span>
            </p>
          </div>
          <div className={`self-start shrink-0 flex flex-col gap-2 bg-[rgba(35,46,61,.7)] border-l-4 ${level ? SCORE_ACCENT[level] : 'border-grey'} px-[22px] pt-4 pb-[18px]`}>
            <span className="text-xs font-semibold tracking-[0.08em] uppercase text-white/80">Opportunity score</span>
            <span className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold leading-none text-white">{formatScore(profile.opportunity_score)}</span>
              <span className="text-sm text-white/80">/ 100{level ? ` · ${level}` : ''}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16">
        {/* ── How attractive (starts on the photo) ─────────────────────────── */}
        <section className="relative -mt-[290px] pt-2 pb-14" aria-labelledby="attractive">
          <div className="border-t-[3px] border-white/70 pt-[22px]">
            <h2 id="attractive" className="on-photo-strong text-[28px] font-semibold tracking-[-0.02em] m-0 text-white">
              How attractive is {markets} market?
            </h2>
            <p className="on-photo text-base leading-[1.5] text-white mt-2 mb-0 max-w-[760px]">
              How much {market} buys, how fast its demand is growing, and how Afghanistan already performs there.
            </p>

            <GroupLabel onPhoto>{market} as a buyer</GroupLabel>
            <CardGrid cols={3}>
              <StatCard
                label="Market size"
                info={`Total value of ${product} that ${market} imported from all countries (UN Comtrade).`}
                icon={<GlobeIcon />}
                value={formatUSD(trade?.global_market_size_usd)}
                description={`${markets} total imports of ${product} from all countries`}
                footer={<YearNote year={tradeYear} current={year} />}
              />
              <StatCard
                label="Market growth"
                info={`Average yearly growth (CAGR) of ${markets} imports of ${product} over the period shown.`}
                icon={<TrendIcon />}
                value={formatPct(trade?.growth.cagr_pct)}
                description={growthPeriod ? `Average growth per year, ${growthPeriod}` : 'Average growth per year'}
                footer={growthPeriod && <span className="text-xs text-muted">{growthPeriod}</span>}
              />
              <StatCard
                label="Year-on-year"
                info={`Change in ${markets} imports of ${product} compared with the year before.`}
                icon={<BarsIcon />}
                value={formatPct(trade?.growth.yoy_growth_pct)}
                description={`Change in ${markets} imports compared with the year before`}
                footer={<YearNote year={trade?.growth.last_year ?? null} current={year} />}
              />
            </CardGrid>

            <GroupLabel>Where Afghanistan stands</GroupLabel>
            <CardGrid cols={3}>
              <StatCard
                label="Afghan exports"
                info={`Value of ${product} Afghanistan sold to ${market}, as reported by ${market} (mirror statistics).`}
                icon={<ExportIcon />}
                value={formatUSD(trade?.afg_export_value_usd)}
                description={
                  showAfgLastExport
                    ? `No recorded exports this year. Last exported ${trade.afg_last_export_year}: ${formatUSD(trade.afg_last_export_value_usd)}`
                    : `Value of ${product} Afghanistan sold to ${market}`
                }
                footer={<YearNote year={tradeYear} current={year} />}
              />
              <StatCard
                label="Market share"
                info={`Afghanistan’s share of ${markets} total imports of ${product}.`}
                icon={<ShareRing pct={trade?.market_share_pct ?? null} />}
                value={formatPct(trade?.market_share_pct, 2, false)}
                description={`of ${markets} imports come from Afghanistan`}
                footer={<YearNote year={tradeYear} current={year} />}
              />
              <StatCard
                label="Supplier rank"
                info={`Afghanistan’s position among all countries supplying ${product} to ${market}, ranked by export value.`}
                icon={<PodiumIcon />}
                value={trade?.afg_supplier_rank != null ? `#${trade.afg_supplier_rank}` : '—'}
                description={`Afghanistan’s position among all countries supplying ${market}`}
                footer={<YearNote year={tradeYear} current={year} />}
              />
            </CardGrid>
          </div>
        </section>
      </div>

      <Band tone="white">
        {/* ── Price ─────────────────────────────────────────────────────────── */}
        <Section
          id="price"
          title="Is Afghanistan’s price competitive?"
          lead={`Afghanistan’s average unit price compared with what ${market} pays on average for the same product.`}
        >
          <div className={`mt-6 bg-white border border-line grid grid-cols-1 ${hasPriceComparison ? 'lg:grid-cols-[320px_1fr]' : ''}`}>
            <div className={`p-7 flex flex-col gap-2.5 ${hasPriceComparison ? 'border-b lg:border-b-0 lg:border-r border-line' : ''}`}>
              <CardHead label="Price gap" info={`How far Afghanistan’s average unit price is from the average ${market} pays all its suppliers. Negative means cheaper.`} icon={<PriceTagIcon />} />
              <div className={`text-4xl font-semibold tracking-[-0.02em] leading-none ${gap == null ? 'text-muted' : gap < 0 ? 'text-green' : gap > 0 ? 'text-danger' : 'text-ink'}`}>
                {gap == null ? '—' : formatPct(gap).replace('-', '−')}
              </div>
              {gap != null ? (
                <p className="text-sm leading-[1.45] text-muted m-0">
                  Afghanistan’s unit price is{' '}
                  <strong className={`font-semibold ${gap < 0 ? 'text-green' : gap > 0 ? 'text-danger' : 'text-ink'}`}>
                    {gap < 0 ? 'below' : gap > 0 ? 'above' : 'in line with'}
                  </strong>{' '}
                  the average price {market} pays its suppliers.
                </p>
              ) : (
                <p className="text-sm leading-[1.45] text-muted m-0">
                  Afghanistan or its competitors didn&apos;t report a comparable unit price for this market, so price
                  competitiveness isn&apos;t factored into the opportunity score here (treated as neutral).
                </p>
              )}
              <div className="mt-auto pt-1"><YearNote year={tradeYear} current={year} /></div>
            </div>
            {hasPriceComparison && (
              <div className="px-6 sm:px-10 pt-6 pb-[18px] overflow-hidden">
                <PriceComparison afghan={price.unit_price_usd!} market={price.market_avg_price_usd!} unit={unit} />
              </div>
            )}
          </div>
        </Section>
      </Band>

      <Band tone="blue">
        {/* ── Access ────────────────────────────────────────────────────────── */}
        <Section
          id="access"
          title={`Market overview of ${market}`}
          lead={`The costs and conditions an Afghan exporter faces when entering ${market}.`}
        >
          <div className="h-6" />
          <CardGrid cols={5}>
            <StatCard
              label="Tariff"
              info={`Import duty ${market} applies to ${product} (${ctx.tariff_indicator ?? 'MFN'} rate, from WITS). Lower is better.`}
              icon={<BarrierIcon />}
              value={ctx.tariff_rate_pct != null ? `${ctx.tariff_rate_pct.toFixed(1)}%` : '—'}
              valueClass={tariffIsBarrier ? 'text-danger' : undefined}
              description={
                ctx.tariff_rate_pct != null
                  ? `Import duty ${market} charges on this product (${ctx.tariff_indicator ?? 'MFN'} rate)`
                  : 'No tariff rate reported for this product'
              }
              footer={
                <>
                  {tariffIsBarrier && (
                    <span className="self-start text-[11.5px] font-semibold tracking-[0.04em] uppercase text-white bg-danger px-2 py-[3px]">
                      Main barrier
                    </span>
                  )}
                  {/* Rates of 30% and above fill the bar */}
                  {ctx.tariff_rate_pct != null && (
                    <Meter pct={(ctx.tariff_rate_pct / 30) * 100} className={tariffIsBarrier ? 'bg-danger' : 'bg-undp'} />
                  )}
                  <YearNote year={ctx.tariff_year} current={year} />
                </>
              }
            />
            <StatCard
              label="Logistics"
              info="World Bank Logistics Performance Index (1–5): quality of trade and transport infrastructure, customs and shipment reliability."
              icon={<TruckIcon />}
              value={ctx.lpi_score != null ? ctx.lpi_score.toFixed(2) : '—'}
              outOf={ctx.lpi_score != null ? '5' : undefined}
              description="World Bank Logistics Performance Index"
              footer={
                <>
                  {ctx.lpi_score != null && <SegmentMeter value={ctx.lpi_score} segments={5} />}
                  <YearNote year={ctx.lpi_score_year} current={year} />
                </>
              }
            />
            <StatCard
              label="Regulatory quality"
              info="World Bank Worldwide Governance Indicator, on a 0–100 scale: how well government policies and rules support private business."
              icon={<DocumentIcon />}
              value={ctx.regulatory_quality != null ? ctx.regulatory_quality.toFixed(0) : '—'}
              outOf={ctx.regulatory_quality != null ? '100' : undefined}
              description="How well rules support private business"
              footer={
                <>
                  {ctx.regulatory_quality != null && <Meter pct={ctx.regulatory_quality} />}
                  <YearNote year={ctx.regulatory_quality_year} current={year} />
                </>
              }
            />
            <StatCard
              label="Political stability"
              info="World Bank Worldwide Governance Indicator, on a 0–100 scale: how unlikely political instability or violence is. Higher means more stable."
              icon={<ShieldIcon />}
              value={ctx.political_stability != null ? ctx.political_stability.toFixed(0) : '—'}
              outOf={ctx.political_stability != null ? '100' : undefined}
              description="Stability, and the risk of disruption from unrest — higher is more stable"
              footer={
                <>
                  {ctx.political_stability != null && <Meter pct={ctx.political_stability} />}
                  <YearNote year={ctx.political_stability_year} current={year} />
                </>
              }
            />
            <StatCard
              label="Income level"
              info="GDP per person in US dollars (World Bank) — a rough guide to buying power."
              icon={<WalletIcon />}
              value={
                ctx.gdp_per_capita_usd != null
                  ? `$${Math.round(ctx.gdp_per_capita_usd).toLocaleString('en-US')}`
                  : '—'
              }
              description="GDP per person — a guide to buying power"
            />
          </CardGrid>
        </Section>
      </Band>

      {/* ── Recommended next steps (playbook: backend/playbook/next_steps.yaml) ──
          Full-width band on a UNDP frosted background, so the page's most
          practical part stands apart from the grey sections around it. */}
      {profile.next_steps.length > 0 && (
        <div className="frosted-background">
          <Image src="/images/frosted-kabul.jpg" alt="" aria-hidden fill sizes="100vw" />
          <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pt-12 pb-6">
            <Section
              id="next-steps"
              title="Recommended next steps"
              lead={`What to do to export ${product} to ${market}, step by step, with links to the details.`}
            >
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">
                <NextSteps steps={profile.next_steps} />
                <div className="flex flex-col gap-5">
                  <div className="bg-white border border-line rounded-md px-6 py-[22px] flex flex-col gap-3">
                    <h3 className="text-base font-semibold m-0">Want help acting on this?</h3>
                    <p className="text-sm leading-[1.5] text-muted m-0">
                      An advisor at your nearest office can walk through these results with you.
                    </p>
                    <span title="Coming soon" className="flex items-center justify-center h-[42px] rounded border border-undp text-undp text-sm font-medium cursor-default">
                      Find your nearest office
                    </span>
                  </div>
                  {profile.next_steps_more && (
                    <p className="m-0">
                      <ExternalLink link={profile.next_steps_more} strong />
                    </p>
                  )}
                  {profile.next_steps_disclaimer && (
                    <p className="text-xs leading-[1.5] text-muted m-0">{profile.next_steps_disclaimer}</p>
                  )}
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}

      <Band tone="white">
        {/* ── Why this score ────────────────────────────────────────────────── */}
        <Section id="why" title="Why this score?" lead="The opportunity score combines eight factors, each weighted by how much it matters.">
          <div className="mt-5 bg-white border border-line px-5 sm:px-7 pt-1 pb-2">
            <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1 py-[18px] border-b border-line">
              <span className="text-xs font-semibold tracking-[0.08em] uppercase text-muted">Opportunity score</span>
              <span className={`text-[30px] font-semibold ${scoreColor(profile.opportunity_score)}`}>{formatScore(profile.opportunity_score)}</span>
              <span className="text-sm text-muted">out of 100{level ? ` · ${level}` : ''}</span>
            </div>
            <div className="pt-5 pb-4">
              <h3 className="text-xs font-semibold tracking-[0.08em] uppercase text-muted m-0">All 8 factors</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3 pt-4">
                {SCORE_DIMENSIONS.map((dim) => (
                  <ScoreBar
                    key={dim.key}
                    label={dim.label}
                    labelWidth={170}
                    score={profile.score_breakdown[dim.key]}
                    weight={dim.weight}
                    displayValue={
                      dim.key === 'tariff' && ctx.tariff_rate_pct != null ? `${ctx.tariff_rate_pct.toFixed(1)}%` : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>
      </Band>

      <Band tone="grey">
        {/* ── Competitors ───────────────────────────────────────────────────── */}
        <div className="pt-2 pb-16">
        {profile.competitors.length > 0 && (
          <Panel title="Top competitors in this market">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left pr-4 pb-2.5 text-[12.5px] font-semibold text-muted border-b border-line">Supplier</th>
                    <th className="text-right pr-4 pb-2.5 text-[12.5px] font-semibold text-muted border-b border-line">Export value</th>
                    <th className="text-right pb-2.5 text-[12.5px] font-semibold text-muted border-b border-line">Market share</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.competitors.map((c) => (
                    <tr key={c.supplier_code}>
                      <td className="py-[11px] pr-4 border-b border-soft font-semibold">{c.supplier_name}</td>
                      <td className="py-[11px] pr-4 border-b border-soft text-right font-mono text-muted">{formatUSD(c.trade_value_usd)}</td>
                      <td className="py-[11px] border-b border-soft">
                        {c.market_share_pct != null ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="hidden sm:block w-[90px] h-1.5 bg-soft rounded-full overflow-hidden">
                              <div className="h-full bg-undp rounded-full" style={{ width: `${Math.min(100, c.market_share_pct)}%` }} />
                            </div>
                            <span className="w-12 text-right font-mono text-muted">{c.market_share_pct.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="block text-right text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        </div>
      </Band>
    </>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────

// Full-width background band around a section. The page alternates them
// (grey, white, light blue) so each section reads as its own block.
const BAND_TONES = { grey: 'bg-paper', white: 'bg-white', blue: 'bg-blue-wash' } as const

function Band({ tone, children }: { tone: keyof typeof BAND_TONES; children: React.ReactNode }) {
  return (
    <div className={BAND_TONES[tone]}>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pt-12">{children}</div>
    </div>
  )
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="pt-2 pb-14" aria-labelledby={id}>
      <div className="border-t-[3px] border-undp pt-[22px]">
        <h2 id={id} className="text-[28px] font-semibold tracking-[-0.02em] m-0">{title}</h2>
        <p className="text-base leading-[1.5] text-muted mt-2 mb-0 max-w-[760px]">{lead}</p>
        {children}
      </div>
    </section>
  )
}

function GroupLabel({ onPhoto = false, children }: { onPhoto?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mt-[30px] mb-3.5">
      <h3 className={`text-[13px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap m-0 ${onPhoto ? 'on-photo text-white' : 'text-ink'}`}>
        {children}
      </h3>
      <div className={`grow h-px ${onPhoto ? 'bg-white/40' : 'bg-line'}`} />
    </div>
  )
}

/** Cards separated by 1px lines, as in the design. */
function CardGrid({ cols, children }: { cols: 3 | 5; children: React.ReactNode }) {
  const grid = cols === 5 ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'md:grid-cols-3'
  return <div className={`grid grid-cols-1 ${grid} gap-px bg-line border border-line`}>{children}</div>
}

function CardHead({ label, info, icon }: { label: string; info: string; icon: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] uppercase text-muted m-0">
        {label}
        <InfoTooltip text={info} />
      </h3>
      <div className="shrink-0 -mt-1">{icon}</div>
    </div>
  )
}

function StatCard({
  label, info, icon, value, outOf, valueClass, description, footer,
}: {
  label: string
  info: string
  icon: React.ReactNode
  value: string
  outOf?: string
  valueClass?: string
  description: string
  footer?: React.ReactNode
}) {
  return (
    <div className="bg-white px-7 pt-[26px] pb-6 flex flex-col gap-2.5 min-h-[176px]">
      <CardHead label={label} info={info} icon={icon} />
      <div className={`text-4xl font-semibold tracking-[-0.02em] leading-none ${value === '—' ? 'text-muted' : (valueClass ?? 'text-undp')}`}>
        {value}
        {outOf && <span className="text-lg font-medium text-muted"> / {outOf}</span>}
      </div>
      <p className="text-sm leading-[1.45] text-muted m-0">{description}</p>
      {footer && <div className="mt-auto flex flex-col gap-2.5">{footer}</div>}
    </div>
  )
}

/** The data year, or an amber warning when it is older than the year scored. */
function YearNote({ year, current }: { year: number | null | undefined; current: number | null }) {
  if (year == null) return null
  if (current != null && year !== current) {
    return (
      <span className="text-xs text-amber" title={`The most recent figure reported is from ${year}, not ${current}.`}>
        ⚠ {year} data
      </span>
    )
  }
  return <span className="text-xs text-muted">{year}</span>
}

function Meter({ pct, className = 'bg-undp' }: { pct: number; className?: string }) {
  return (
    <div className="h-2 bg-soft">
      <div className={`h-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

function SegmentMeter({ value, segments }: { value: number; segments: number }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className="flex-1 h-2 bg-soft relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-undp" style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }} />
        </div>
      ))}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-md p-6">
      <h2 className="text-[12.5px] font-semibold tracking-[0.06em] uppercase text-muted m-0 mb-[18px]">{title}</h2>
      {children}
    </div>
  )
}
