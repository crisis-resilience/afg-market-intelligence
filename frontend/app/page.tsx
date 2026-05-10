import { getProducts } from '@/lib/api'
import ProductGrid from '@/components/ProductGrid'

export default async function HomePage() {
  const products = await getProducts()

  const withData = products.filter((p) => p.has_data).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Afghan Export Market Discovery
        </h1>
        <p className="text-gray-500 text-sm">
          Select a product to discover and rank the best new export markets — scored across market
          size, growth, tariffs, logistics, and more.
        </p>
        {products.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            {products.length} products · {withData} with scored markets
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm mb-2">No products loaded yet.</p>
          <p className="text-gray-400 text-xs">
            Run the ETL pipeline to populate the database:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              docker-compose exec backend python -m etl.run
            </code>
          </p>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  )
}
