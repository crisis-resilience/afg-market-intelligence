import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { siteUrl } from '@/lib/site'

// Self-hosted by next/font, so the browser never calls Google (the Caddy CSP
// only allows fonts from this origin).
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-plex-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export const metadata: Metadata = {
  title: 'Find your market — MSME Support Centre',
  description:
    'Identify and rank the best new export markets for Afghan products — powered by UN Comtrade, World Bank, and WITS data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader siteUrl={siteUrl()} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
