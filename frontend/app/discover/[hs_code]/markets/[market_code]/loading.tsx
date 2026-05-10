export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="h-10 w-80 bg-gray-200 rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
