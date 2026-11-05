import { notFound } from 'next/navigation'
import { getDiscoveryResult } from '@/lib/api'
import { parseImportance } from '@/lib/scoring'
import MarketRanking from '@/components/MarketRanking'
import { Breadcrumb, PortPhoto, ToolSteps } from '@/components/ToolChrome'

export default async function DiscoverPage(props: PageProps<'/discover/[hs_code]'>) {
  const { hs_code } = await props.params
  const searchParams = await props.searchParams
  const minScore = searchParams?.min_score ? Number(searchParams.min_score) || undefined : undefined
  const importance = parseImportance(searchParams?.w)

  // All markets: scoring, ranking and the minimum-score filter happen in
  // MarketRanking, with the weights the user picks
  const result = await getDiscoveryResult(hs_code)
  if (!result) notFound()

  const productName = result.product_name ?? `HS ${result.hs_code}`

  return (
    <>
      <ToolSteps current={2} links={['/']} />
      <MarketRanking
        hsCode={hs_code}
        markets={result.markets}
        initialImportance={importance}
        initialMinScore={minScore}
        photo={<PortPhoto />}
        heading={
          <div className="flex flex-col gap-3 max-w-[760px]">
            <Breadcrumb trail={[{ label: 'Find your market', href: '/' }, { label: productName }]} />
            <h1 className="on-photo-strong text-[34px] sm:text-[44px] font-semibold tracking-[-0.028em] leading-[1.08] m-0 text-white">
              {productName}
            </h1>
            <p className="on-photo font-mono text-[15px] text-white m-0">
              HS {result.hs_code} · {result.total_markets_scored} markets scored · {result.computed_for_year}
            </p>
          </div>
        }
      />
    </>
  )
}
