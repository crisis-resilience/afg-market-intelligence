import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-[#0468B1] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <span className="text-xs font-bold tracking-widest uppercase border border-white/60 px-2 py-0.5 rounded">
              UNDP
            </span>
            <span className="text-sm font-semibold hidden sm:block">
              AFG Market Diversification Tool
            </span>
            <span className="text-sm font-semibold sm:hidden">AFG MDT</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
              Products
            </Link>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-60 hover:opacity-80 transition-opacity text-xs"
            >
              API docs
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
