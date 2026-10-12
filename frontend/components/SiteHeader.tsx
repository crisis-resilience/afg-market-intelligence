'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

// Same header as the public website. Its pages live on the website's own
// domain (`siteUrl`, from lib/site.ts via the layout), so those links are
// absolute; "Find your market" is this app.
export default function SiteHeader({ siteUrl }: { siteUrl: string }) {
  const siteLink = (path: string) => `${siteUrl}${path}`
  const NAV: { label: string; href?: string; current?: boolean }[] = [
    { label: 'Home', href: siteLink('/') },
    { label: 'About', href: siteLink('/#about') },
    { label: 'Find your market', current: true },
    { label: 'Trainings & Events', href: siteLink('/events.html') },
    { label: 'Find your nearest office' },
    { label: 'FAQ' },
  ]
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-20 h-[76px] bg-white border-b border-line">
      <div className="mx-auto max-w-[1440px] h-full px-5 sm:px-10 min-[1181px]:px-16 flex items-center gap-10">
        <a href={siteLink('/')} className="flex items-center gap-[11px] shrink-0 no-underline" aria-label="MSME Support Centre, Afghanistan — website home">
          <BrandMark />
          <span className="flex flex-col gap-px leading-[1.1]">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">MSME Support Centre</span>
            <span className="text-[10.5px] tracking-[0.05em] text-muted">AFGHANISTAN</span>
          </span>
        </a>

        <button
          type="button"
          className="ml-auto inline-flex items-center gap-2 py-2 px-1 text-sm font-medium text-ink min-[1181px]:hidden"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" fill="currentColor">
            <rect y="0" width="20" height="2" /><rect y="6" width="20" height="2" /><rect y="12" width="20" height="2" />
          </svg>
          Menu
        </button>

        <nav
          id="site-nav"
          aria-label="Main"
          className={`${open ? 'flex' : 'hidden'} absolute top-[76px] inset-x-0 flex-col bg-white border-b border-line px-5 sm:px-10 pt-2 pb-5 shadow-[0_12px_24px_-16px_rgba(35,46,61,.35)]
            min-[1181px]:static min-[1181px]:flex min-[1181px]:flex-row min-[1181px]:items-center min-[1181px]:grow min-[1181px]:gap-10 min-[1181px]:p-0 min-[1181px]:border-0 min-[1181px]:shadow-none`}
        >
          <ul className="flex flex-col min-[1181px]:flex-row min-[1181px]:gap-[26px] min-[1181px]:grow text-base min-[1181px]:text-sm list-none m-0 p-0">
            {NAV.map((item) => (
              <li key={item.label} className="border-b border-soft min-[1181px]:border-0">
                {item.current ? (
                  <Link
                    href="/"
                    aria-current="page"
                    className="block min-[1181px]:inline-block py-3.5 min-[1181px]:py-0 min-[1181px]:pb-[3px] pl-3 min-[1181px]:pl-0 shadow-[inset_3px_0_0_var(--color-red)] min-[1181px]:shadow-none min-[1181px]:border-b-2 min-[1181px]:border-red font-medium text-undp no-underline whitespace-nowrap"
                  >
                    {item.label}
                  </Link>
                ) : item.href ? (
                  <a href={item.href} className="block min-[1181px]:inline-block py-3.5 min-[1181px]:py-0 min-[1181px]:pb-[3px] min-[1181px]:border-b-2 min-[1181px]:border-transparent text-muted hover:text-undp no-underline whitespace-nowrap">
                    {item.label}
                  </a>
                ) : (
                  <span title="Coming soon" className="block min-[1181px]:inline-block py-3.5 min-[1181px]:py-0 min-[1181px]:pb-[3px] min-[1181px]:border-b-2 min-[1181px]:border-transparent text-muted opacity-70 cursor-default whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {/* Dari and Pashto versions are not published yet */}
          <div className="pt-4 min-[1181px]:pt-0 text-[15px] min-[1181px]:text-[13.5px] text-muted whitespace-nowrap">
            <span lang="en" className="font-medium text-undp">English</span> ·{' '}
            <bdi lang="fa-AF" dir="rtl" title="Coming soon">دری</bdi> ·{' '}
            <bdi lang="ps" dir="rtl" title="Coming soon">پښتو</bdi>
          </div>
        </nav>
      </div>
    </header>
  )
}
