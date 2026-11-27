'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Short help texts that stay out of the way until the reader asks for them:
// - HelpBox: folds out in place ("How to use this tool" on the product page).
// - HelpPanel: a button that slides a panel in from the right, beside the
//   page, so a long text doesn't push the page down and the page can still be
//   scrolled while it is open ("How to read this page" on a market profile). Card 1 of the next steps opens it with openHelpBox().

export const HOW_TO_READ_ID = 'how-to-read'

const OPEN_EVENT = 'helpbox:open'

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" strokeLinecap="round" />
    </svg>
  )
}

export default function HelpBox({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <details
      id={id}
      className="group w-full bg-white text-ink rounded-[4px] border border-line max-w-[760px] scroll-mt-28 transition-shadow duration-500"
    >
      <summary className="flex items-center gap-2.5 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-semibold text-undp">
        <InfoIcon />
        {title}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
          className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[14.5px] leading-[1.6] flex flex-col gap-3">{children}</div>
    </details>
  )
}

export function HelpPanel({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => setMounted(true), [])

  // openHelpBox(id) from elsewhere on the page (card 1 of the next steps)
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [id])

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) trigger.current?.focus({ preventScroll: true })
  }, [])

  // The panel sits beside the page rather than blocking it: the page still
  // scrolls and can be clicked. Focus moves into the panel when it opens, and
  // Esc closes it from anywhere on the page.
  useEffect(() => {
    if (!open) return
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // A link to a section on this page: go there, keeping the panel open beside
  // it; on a phone the panel covers the page, so it closes first
  const onClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a')
    const hash = link?.getAttribute('href')
    if (!hash?.startsWith('#')) return
    e.preventDefault()
    if (!window.matchMedia('(min-width: 768px)').matches) close(false)
    requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1))
      if (!target) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
      history.replaceState(null, '', hash)
    })
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full max-w-[760px] flex items-center gap-2.5 px-4 py-3 bg-white rounded-[4px] border border-line cursor-pointer text-left text-[15px] font-semibold text-undp hover:border-undp transition-colors"
      >
        <InfoIcon />
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="ml-auto">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {/* In <body>, so nothing on the page can clip or cover it */}
      {mounted && createPortal(
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            inert={!open}
            onClick={onClick}
            className={`fixed top-0 right-0 z-[100] h-full w-full max-w-[460px] bg-white text-ink border-l-4 border-undp shadow-[-16px_0_40px_-12px_rgba(35,46,61,.55)] flex flex-col transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none ${
              open ? 'translate-x-0 visible' : 'translate-x-full invisible'
            }`}
          >
            {/* A solid blue header, so the panel reads as separate from the page */}
            <div className="flex items-center gap-2.5 px-5 py-4 bg-undp text-white">
              <InfoIcon />
              <h2 id={titleId} className="text-[17px] font-semibold m-0">{title}</h2>
              <button
                ref={closeBtn}
                type="button"
                onClick={() => close()}
                aria-label="Close"
                className="ml-auto w-9 h-9 -mr-2 flex items-center justify-center rounded-full bg-transparent border-0 cursor-pointer text-white hover:bg-white/15 focus-visible:outline-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-[14.5px] leading-[1.6] flex flex-col gap-3">{children}</div>
          </div>,
        document.body,
      )}
    </>
  )
}

/** Open a help text: a HelpPanel slides in; a HelpBox unfolds, comes into
 *  view and is highlighted for a moment. */
export function openHelpBox(id: string) {
  const box = document.getElementById(id)
  if (!(box instanceof HTMLDetailsElement)) {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
    return
  }
  box.open = true
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  box.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  box.classList.add('shadow-[0_0_0_4px_#B5D5F5]')
  window.setTimeout(() => box.classList.remove('shadow-[0_0_0_4px_#B5D5F5]'), 2500)
}

/** A heading inside a help box. */
export function HelpHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[14.5px] font-semibold text-ink m-0 mt-1">{children}</h3>
}
