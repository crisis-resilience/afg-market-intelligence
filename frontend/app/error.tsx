'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        Market data is temporarily unavailable
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        The service could not load the latest data. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[#0468B1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#035999] focus:outline-none focus:ring-2 focus:ring-[#0468B1] focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  )
}
