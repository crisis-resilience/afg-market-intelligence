import Link from 'next/link'
import { siteLink } from '@/lib/site'
import BrandMark from '@/components/BrandMark'

// Same footer as the public website. Entries without an href have no page yet.
const columns = (): { heading: string; links: { label: string; href?: string; inApp?: boolean }[] }[] => [
  {
    heading: 'Find your market',
    links: [
      { label: 'Market Intelligence Tool', href: '/', inApp: true },
      { label: 'How to use it' },
      { label: 'Understanding your score' },
      { label: 'Sector briefs' },
    ],
  },
  {
    heading: 'Trainings & Events',
    links: [
      { label: 'Upcoming', href: siteLink('/events.html') },
      { label: 'Export readiness', href: siteLink('/events.html?topic=export-readiness') },
      { label: 'Finance', href: siteLink('/events.html?topic=finance') },
      { label: 'B2B & matchmaking', href: siteLink('/events.html?type=b2b') },
    ],
  },
  {
    heading: 'Offices',
    links: [{ label: 'Kabul centre' }, { label: 'Province directory' }, { label: 'Book an appointment' }],
  },
  {
    heading: 'About',
    links: [{ label: 'What we do', href: siteLink('/#about') }, { label: 'Contact' }],
  },
]

export default function SiteFooter() {
  return (
    <footer className="bg-ink text-soft pt-[52px]">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 xl:px-16">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-[72px] items-start">
          <div className="lg:w-[300px] shrink-0 flex flex-col gap-3.5">
            <div className="flex items-center gap-[11px] text-[15px] font-semibold">
              <BrandMark size={28} onDark />
              MSME Support Centre
            </div>
            <p className="text-[13.5px] leading-[1.6] text-grey m-0">
              Export readiness, market intelligence and access to finance for Afghan micro, small and medium enterprises.
            </p>
            <address className="not-italic flex flex-col gap-[5px] text-[13.5px] text-line">
              <span>[STREET ADDRESS], Kabul</span>
              <span className="font-mono">[HELPLINE] · [WHATSAPP]</span>
            </address>
          </div>

          <nav aria-label="Footer" className="w-full lg:grow grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-7 gap-y-8">
            {columns().map((col) => (
              <div key={col.heading}>
                <h2 className="text-xs font-semibold tracking-[0.08em] uppercase text-grey m-0 mb-2.5">{col.heading}</h2>
                <ul className="list-none m-0 p-0 flex flex-col gap-[7px] text-[13.5px] text-line">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.inApp && l.href ? (
                        <Link href={l.href} className="text-line no-underline hover:text-white hover:underline">{l.label}</Link>
                      ) : l.href ? (
                        <a href={l.href} className="text-line no-underline hover:text-white hover:underline">{l.label}</a>
                      ) : (
                        <span title="Coming soon">{l.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-muted mt-10 pt-[22px] pb-7 text-[12.5px] text-grey">
          © 2026 MSME Support Centre · <span title="Coming soon">Privacy</span>
          <span className="block sm:inline sm:float-right mt-2 sm:mt-0">
            Data: UN Comtrade (mirror statistics) · World Bank WDI/WGI · WITS tariffs
          </span>
        </div>
      </div>
    </footer>
  )
}
