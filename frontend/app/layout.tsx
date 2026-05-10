import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'AFG Market Diversification Tool',
  description:
    'Identify and rank the best new export markets for Afghan products — powered by UN Comtrade, World Bank, and WITS data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex flex-col bg-[#F7F7F7] text-[#1A1A1A]">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400 bg-white">
          Data: UN Comtrade (mirror statistics) · World Bank WDI/WGI · WITS tariffs
        </footer>
      </body>
    </html>
  )
}
