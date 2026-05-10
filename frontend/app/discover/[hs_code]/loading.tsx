export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
