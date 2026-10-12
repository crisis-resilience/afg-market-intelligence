'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ProductSummary } from '@/lib/types'
import { formatUSD } from '@/lib/utils'
import { PortPhoto } from '@/components/ToolChrome'

const ALL = 'All'

// The photo banner holds the search and category filters, so it is drawn
// here with the grid; `intro` is the page's breadcrumb, title and lead.
export default function ProductGrid({ products, intro }: { products: ProductSummary[]; intro: React.ReactNode }) {
  const categories = [ALL, ...Array.from(new Set(products.map((p) => p.category))).sort()]
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL)

  const filtered = products.filter((p) => {
    const matchesCategory = activeCategory === ALL || p.category === activeCategory
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.hs_codes.some((c) => c.includes(query))
    return matchesCategory && matchesQuery
  })

  return (
    <>
      <section className="relative overflow-hidden bg-ink pb-[110px]">
        <PortPhoto />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16">
          <div className="pt-12 pb-7">{intro}</div>

          {products.length > 0 && (
            <div className="pb-7 flex flex-col gap-[18px]">
              {/* Results filter as you type; the button is there for people who expect one */}
              <form role="search" className="flex items-stretch max-w-[760px]" onSubmit={(e) => e.preventDefault()}>
                <div className="relative grow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#55606E" strokeWidth="2" strokeLinecap="square" aria-hidden="true" className="absolute left-4 top-[15px]">
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    aria-label="Search products"
                    placeholder="Search by product name or HS code…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="block w-full h-12 pl-11 pr-3.5 bg-white text-ink text-base border-2 border-black border-r-0 rounded-none appearance-none placeholder:text-grey focus:outline-0 focus:shadow-[0_0_4px_#1F5A95]"
                  />
                </div>
                <button type="submit" className="button-primary button-arrow h-12">Search</button>
              </form>

              <div className="flex items-center gap-2.5 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-sm px-4 py-2 rounded-full border cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-undp border-undp text-white font-medium'
                        : 'bg-white border-line text-muted hover:border-undp hover:text-undp'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <span className="on-photo ml-auto font-mono text-[13px] text-white" aria-live="polite">
                  {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-[90px]">
        {products.length === 0 ? (
          <div className="bg-white border border-line rounded-md p-12 text-center">
            <p className="text-ink text-[15px] font-medium m-0 mb-2">Market data is being prepared.</p>
            <p className="text-muted text-sm m-0">Please check back later or contact the service administrator.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-line rounded-md p-12 text-center text-muted text-[15px]">
            No products match your search.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 list-none m-0 p-0">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ProductCard({ product }: { product: ProductSummary }) {
  const primaryHsCode = product.hs_codes[0]

  return (
    <li className="bg-white border border-line rounded-md p-[22px] flex flex-col gap-3.5 min-h-[262px]">
      <div className="flex justify-between items-start gap-2">
        <span className="text-[11.5px] font-semibold text-undp bg-blue-tint px-[9px] py-[3px] rounded-[3px]">{product.category}</span>
        {product.has_data ? (
          <span className="text-[11.5px] font-medium text-green bg-green-tint px-[9px] py-[3px] rounded-[3px] whitespace-nowrap">Data available</span>
        ) : (
          <span className="text-[11.5px] text-muted bg-soft px-[9px] py-[3px] rounded-[3px] whitespace-nowrap">No data yet</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] leading-[1.25] min-h-[2.5em] m-0">{product.name}</h2>
        <p className="font-mono text-[12.5px] text-muted m-0">HS {product.hs_codes.join(', ')}</p>
      </div>

      {product.has_data && (product.total_export_value_usd != null || product.top_market_name) && (
        <dl className="flex flex-col gap-[7px] text-[13.5px] border-t border-soft pt-3.5 m-0">
          {product.total_export_value_usd != null && (
            <div className="flex justify-between gap-2.5">
              <dt className="text-muted">Afghan exports{product.last_year ? ` (${product.last_year})` : ''}</dt>
              <dd className="m-0 font-medium text-right font-mono">{formatUSD(product.total_export_value_usd)}</dd>
            </div>
          )}
          {product.top_market_name && (
            <div className="flex justify-between gap-2.5">
              <dt className="text-muted">Top market</dt>
              <dd className="m-0 font-medium text-right">{product.top_market_name}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-auto">
        {product.has_data ? (
          <Link
            href={`/discover/${primaryHsCode}`}
            className="flex items-center justify-center gap-2 h-11 rounded bg-undp text-white text-[14.5px] font-medium no-underline hover:bg-undp-dark"
          >
            Discover markets <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="flex items-center justify-center h-11 rounded bg-soft text-muted text-sm cursor-not-allowed">
            No data available yet
          </span>
        )}
      </div>
    </li>
  )
}
