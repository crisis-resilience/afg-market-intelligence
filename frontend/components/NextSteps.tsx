'use client'

import { useState } from 'react'
import type { NextStep, StepLink } from '@/lib/types'

// The steps come from the playbook (backend/playbook/next_steps.yaml): each has
// a short instruction and links that open on this product and market.
//
// Shown as a deck: the current step's card in front, the next ones peeking out
// behind it like a stack of pages, earlier ones slid away to the left. The
// UNDP pagination under it, a click on a peeking card, or the arrow keys move
// through it. All cards share one grid cell, so the deck is as tall as the
// longest step and doesn't jump between steps.

const PEEK_PX = 14 // offset of each card behind the current one
const MAX_PEEK = 2 // cards visible behind the current one

export default function NextSteps({ steps }: { steps: NextStep[] }) {
  const [current, setCurrent] = useState(0)
  if (steps.length === 0) return null

  const last = steps.length - 1
  const go = (i: number) => setCurrent(Math.max(0, Math.min(last, i)))

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Recommended next steps"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1) }
      }}
    >
      {/* The deck */}
      <ol
        className="grid list-none m-0 p-0"
        style={{ paddingRight: PEEK_PX * MAX_PEEK, paddingBottom: PEEK_PX * MAX_PEEK }}
      >
        {steps.map((step, i) => {
          const depth = i - current // 0 = in front, >0 behind, <0 already seen
          const visible = depth >= 0 && depth <= MAX_PEEK
          const offset = Math.max(0, depth) * PEEK_PX
          return (
            <li
              key={step.order}
              className={`group [grid-area:1/1] transition-all duration-300 ease-out motion-reduce:transition-none ${
                depth > 0 ? 'cursor-pointer' : ''
              }`}
              style={{
                transform: depth < 0 ? 'translateX(-32px)' : `translate(${offset}px, ${offset}px)`,
                opacity: visible ? 1 : 0,
                zIndex: steps.length - Math.abs(depth),
                pointerEvents: visible ? 'auto' : 'none',
              }}
              onClick={depth > 0 ? () => go(i) : undefined}
              aria-hidden={depth !== 0}
            >
              <StepCard step={step} front={depth === 0} />
            </li>
          )
        })}
      </ol>

      {/* UNDP Design System pagination (2.0.3, MIT licence): circled arrows
          around "Page n of N"; an arrow fades when there is no page that way. */}
      <nav aria-label="Steps" className="mt-5">
        <ul className="flex items-center gap-6 list-none m-0 p-0 text-base text-black">
          <li className="flex">
            <PageArrow direction="previous" disabled={current === 0} onClick={() => go(current - 1)} />
          </li>
          <li className="flex" aria-live="polite">
            Page<span className="mx-1.5 font-semibold">{current + 1}</span>of
            <span className="ml-1.5 font-semibold">{steps.length}</span>
          </li>
          <li className="flex">
            <PageArrow direction="next" disabled={current === last} onClick={() => go(current + 1)} />
          </li>
        </ul>
      </nav>
    </div>
  )
}

function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Previous step' : 'Next step'}
      className="w-[45px] h-[45px] p-0 bg-transparent border-0 cursor-pointer disabled:cursor-default disabled:opacity-30 transition-opacity"
    >
      <svg width="45" height="44" viewBox="0 0 45 44" fill="none" aria-hidden="true">
        <circle cx="22.275" cy="21.996" r="21.996" fill="#232E3D" />
        <path
          d={direction === 'previous' ? 'M26.0505 30.4917L16.4998 22.4976L26.0505 14.4976' : 'M18.4995 14.5L28.0503 22.4941L18.4995 30.4941'}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}

// Cards behind the front one are inert: their links can't be tabbed to or
// clicked, while a click still reaches the card's <li> and brings it forward.
function StepCard({ step, front }: { step: NextStep; front: boolean }) {
  return (
    <div
      inert={!front}
      className={`h-full bg-white border border-line border-t-[3px] border-t-undp rounded-md p-6 flex flex-col gap-3 transition-transform duration-200 motion-reduce:transition-none ${
        front
          ? 'shadow-[0_12px_28px_-16px_rgba(35,46,61,.45)]'
          : 'shadow-[0_6px_16px_-12px_rgba(35,46,61,.35)] group-hover:-translate-y-1.5'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span
          className="shrink-0 w-11 h-11 rounded-full bg-undp text-white font-mono text-lg font-medium flex items-center justify-center"
          aria-hidden="true"
        >
          {step.order}
        </span>
        <h3 className="text-lg font-semibold leading-[1.3] m-0">
          <span className="sr-only">Step {step.order}: </span>
          {step.title}
        </h3>
      </div>
      {step.to_confirm && (
        <p className="self-start text-[11.5px] font-semibold text-amber-dark bg-amber-tint px-2 py-0.5 rounded-[3px] m-0">
          Being confirmed with ACCI
        </p>
      )}
      <p className="text-[14.5px] leading-[1.6] text-muted m-0 max-w-[70ch]">{step.description}</p>
      {step.links.length > 0 && (
        <ul className="list-none m-0 p-0 mt-auto pt-4 border-t border-soft flex flex-col gap-2">
          {step.links.map((link) => (
            <li key={link.url}>
              <ExternalLink link={link} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ExternalLink({ link, strong = false }: { link: StepLink; strong?: boolean }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-[14px] leading-[1.4] text-undp no-underline hover:underline ${strong ? 'font-semibold' : ''}`}
    >
      {link.label} <span aria-hidden="true">→</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
