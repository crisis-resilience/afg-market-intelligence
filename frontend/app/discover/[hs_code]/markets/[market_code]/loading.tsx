import { ToolSteps } from '@/components/ToolChrome'

export default function Loading() {
  return (
    <>
      <ToolSteps current={3} />
      <div className="bg-ink h-[600px] animate-pulse" />
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 pb-16 -mt-[290px] relative" aria-busy="true" aria-label="Loading market profile">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line mt-[150px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[176px] bg-white animate-pulse" />
          ))}
        </div>
      </div>
    </>
  )
}
