'use client'

import { useState } from 'react'

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More info"
        aria-expanded={open}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-grey text-muted text-[9.5px] font-semibold leading-none cursor-help hover:border-undp hover:text-undp focus-visible:border-undp focus-visible:text-undp"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 rounded bg-ink text-white text-xs font-normal leading-snug px-3 py-2 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}
