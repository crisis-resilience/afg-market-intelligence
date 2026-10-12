import { ToolSteps } from '@/components/ToolChrome'

export default function Loading() {
  return (
    <>
      <ToolSteps current={2} links={['/']} />
      <div className="bg-ink h-[260px] animate-pulse" />
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-20 flex flex-col gap-3.5" aria-busy="true" aria-label="Loading markets">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[150px] bg-white border border-line rounded-md animate-pulse" />
        ))}
      </div>
    </>
  )
}
