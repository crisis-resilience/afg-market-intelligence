'use client'

import { useEffect, useState } from 'react'

/** Round button in the bottom corner that appears once the reader has scrolled
 *  down a screen, and takes them back to the top. Same look as the website's. */
export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      className={`fixed bottom-4 end-4 sm:bottom-6 sm:end-6 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full border-0 p-0 flex items-center justify-center bg-undp text-white cursor-pointer shadow-[0_2px_8px_rgba(35,46,61,.25)] hover:bg-undp-dark transition-all duration-200 motion-reduce:transition-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
