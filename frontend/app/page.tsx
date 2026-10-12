import { getProducts } from '@/lib/api'
import ProductGrid from '@/components/ProductGrid'
import { Breadcrumb, ToolSteps } from '@/components/ToolChrome'

export default async function HomePage() {
  const products = await getProducts()

  const intro = (
    <div className="flex flex-col gap-3 max-w-[760px]">
      <Breadcrumb trail={[{ label: 'Find your market' }]} />
      <h1 className="on-photo-strong text-[34px] sm:text-[44px] font-semibold tracking-[-0.028em] leading-[1.08] m-0 text-white">
        Find your market
      </h1>
      <p className="on-photo text-[17.5px] leading-[1.5] text-white m-0">
        Choose a product to discover and rank the best new export markets for it — scored on market size, growth,
        tariffs, logistics and more.
      </p>
    </div>
  )

  return (
    <>
      <ToolSteps current={1} />
      <ProductGrid products={products} intro={intro} />
    </>
  )
}
