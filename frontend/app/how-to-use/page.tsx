import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumb, PortPhoto, ToolSteps } from '@/components/ToolChrome'

export const metadata: Metadata = {
  title: 'How to use this tool · Market Intelligence Tool',
}

// A short guide to the tool, reached from the first tab of the step bar.

export default function HowToUsePage() {
  return (
    <>
      <ToolSteps current={0} />

      <section className="relative overflow-hidden bg-ink pb-[110px]">
        <PortPhoto />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pt-12 pb-7">
          <div className="flex flex-col gap-3 max-w-[760px]">
            <Breadcrumb trail={[{ label: 'Find your market', href: '/' }, { label: 'How to use this tool' }]} />
            <h1 className="on-photo-strong text-[34px] sm:text-[44px] font-semibold tracking-[-0.028em] leading-[1.08] m-0 text-white">
              How to use this tool
            </h1>
            <p className="on-photo text-[17.5px] leading-[1.5] text-white m-0">
              Find out where your products could sell abroad, in a few steps.
            </p>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-[90px]">
        <article className="bg-white border border-line rounded-md p-6 sm:p-8 max-w-[860px] flex flex-col gap-5 text-[15.5px] leading-[1.65] text-ink">
          <p className="m-0">
            The market intelligence tool helps Afghan exporters find out where their products could sell abroad. For each
            product, it lists the countries that import it and ranks them from the best opportunity to the weakest, using
            trade data from the UN, the World Bank and WITS. Use it to get a first picture of a market, compare countries
            side by side, and identify new export markets to diversify your sales beyond your current buyers. For each
            country you also get the key market figures and, where available, the rules, duties and practical next steps
            for exporting there.
          </p>
          <ol className="list-decimal m-0 pl-5 flex flex-col gap-2.5 marker:text-undp marker:font-semibold">
            <li>
              Type a product name or HS code in the search box. Then click “Discover markets” on the product to open its
              page, which ranks the countries that import it.
            </li>
            <li>You will see a list of countries that buy this product. The best markets for Afghan exporters are at the top.</li>
            <li>Each country has a score from 0 to 100. A higher score indicates a stronger export opportunity for Afghan producers.</li>
            <li>
              The score is based on 8 factors: market size, market growth, market quality, price, tariff, Afghan foothold,
              distance and language. By default, each factor carries equal weight, so no single one decides the score on
              its own.
            </li>
            <li>
              If one factor matters more to your business, for example the tariff, set it to “Very important”. The scores
              and the ranking update to match.
            </li>
            <li>Click a country to see its profile and the recommended steps for exporting there.</li>
          </ol>
          <div className="pt-2">
            <Link href="/" className="button-primary button-arrow no-underline">
              Choose a product
            </Link>
          </div>
        </article>
      </div>
    </>
  )
}
