import type { NextStep } from '@/lib/types'

export default function NextSteps({ steps }: { steps: NextStep[] }) {
  if (steps.length === 0) return null
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.order} className="flex gap-4">
          <span className="shrink-0 w-7 h-7 rounded-full bg-[#0468B1] text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {step.order}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">{step.title}</p>
            <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
            {step.resource_url && (
              <a
                href={step.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0468B1] hover:underline mt-1 inline-block"
              >
                {new URL(step.resource_url).hostname} →
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
