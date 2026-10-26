import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

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
        <main className="flex-1">{children}</main>
        {/* The website has the full footer; the tool only credits its data sources */}
        <p className="m-0 mx-auto w-full max-w-[1440px] px-5 sm:px-10 xl:px-16 py-6 text-xs text-muted">
          Data: UN Comtrade (mirror statistics) · World Bank WDI/WGI · WITS tariffs
        </p>
      </body>
    </html>
  )
}
