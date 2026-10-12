'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto px-5 py-20 text-center">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] m-0 mb-2">Market data is temporarily unavailable</h1>
      <p className="text-base text-muted m-0 mb-7">
        The service could not load the latest data. Please try again in a moment.
      </p>
      <button type="button" onClick={reset} className="button-primary button-arrow">
        Try again
      </button>
    </div>
  )
}
