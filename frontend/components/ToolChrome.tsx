import Image from 'next/image'
import Link from 'next/link'
import { siteLink } from '@/lib/site'

// The pieces every screen of the tool shares: the step bar at the top (the
// app has no website menu bar -- a home icon in the step bar leads back to the
// website), the port photo banner, and the breadcrumb that sits on it.

const STEPS = ['Choose a product', 'Compare markets', 'Market profile'] as const

/** Step bar. `links` holds the href for each step already passed. */
export function ToolSteps({ current, links = [] }: { current: 1 | 2 | 3; links?: string[] }) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-line">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16 py-3.5 flex items-center gap-7">
        <a
          href={siteLink('/')}
          title="Back to the MSME Support Centre website"
          aria-label="Back to the MSME Support Centre website"
          className="shrink-0 -ml-2 w-10 h-10 rounded-full inline-flex items-center justify-center text-undp hover:bg-soft"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
          </svg>
        </a>
        <span className="-ml-4 text-sm font-semibold whitespace-nowrap">Market Intelligence Tool</span>
        <span className="hidden md:block w-px h-6 bg-line" aria-hidden="true" />
        <ol className="hidden md:flex items-center gap-3.5 list-none m-0 p-0" aria-label="Steps">
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3
            const done = n < current
            const isCurrent = n === current
            const marker = done ? (
              <span className="w-6 h-6 rounded-full border-[1.5px] border-undp inline-flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0468B1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
              </span>
            ) : (
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-mono text-xs ${isCurrent ? 'bg-undp text-white font-medium' : 'border-[1.5px] border-grey text-muted'}`}>
                {n}
              </span>
            )
            const content = (
              <>
                {marker}
                {label}
              </>
            )
            const cls = `flex items-center gap-2.5 text-sm no-underline ${
              done ? 'font-medium text-undp hover:underline' : isCurrent ? 'font-semibold text-ink' : 'text-muted'
            }`
            return (
              <li key={label} className="flex items-center gap-3.5">
                {i > 0 && <span className="w-12 h-px bg-line" aria-hidden="true" />}
                {done && links[i] ? (
                  <Link href={links[i]} className={cls}>{content}</Link>
                ) : (
                  <span className={cls} aria-current={isCurrent ? 'step' : undefined}>{content}</span>
                )}
              </li>
            )
          })}
        </ol>
        {/* Phones: just say where you are */}
        <span className="md:hidden ml-auto text-[13px] text-muted whitespace-nowrap">
          Step {current} of 3 · {STEPS[current - 1]}
        </span>
      </div>
    </div>
  )
}

/** Port photo with the darkening gradients from the design. */
export function PortPhoto({ alt = '' }: { alt?: string }) {
  return (
    <>
      <Image
        src="/images/banner-port.jpg"
        alt={alt}
        aria-hidden={alt ? undefined : true}
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(35,46,61,0)_40%,rgba(35,46,61,.35)_100%),linear-gradient(to_right,rgba(35,46,61,.62)_0%,rgba(35,46,61,.38)_50%,rgba(35,46,61,.18)_100%)]"
      />
    </>
  )
}

/** Breadcrumb on the photo: website Home, then the given trail. The last item is the current page. */
export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  const chevron = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  )
  return (
    <nav aria-label="Breadcrumb" className="on-photo flex flex-wrap items-center gap-[9px] text-[13.5px]">
      <a href={siteLink('/')} className="text-white/90 no-underline hover:text-white hover:underline">Home</a>
      {trail.map((item, i) => {
        const last = i === trail.length - 1
        return (
          <span key={item.label} className="flex items-center gap-[9px]">
            {chevron}
            {last ? (
              <span aria-current="page" className="text-white">{item.label}</span>
            ) : item.href ? (
              <Link href={item.href} className="text-white/80 no-underline hover:text-white hover:underline">{item.label}</Link>
            ) : (
              <span className="text-white/80">{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
