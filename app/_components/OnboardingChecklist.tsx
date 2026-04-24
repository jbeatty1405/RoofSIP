'use client'

import Link from 'next/link'
import { useState } from 'react'

type Step = {
  label: string
  description: string
  href: string
  done: boolean
}

export default function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const [dismissed, setDismissed] = useState(false)
  const allDone = steps.every(s => s.done)

  if (dismissed || allDone) return null

  const completed = steps.filter(s => s.done).length

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold text-zinc-900 text-sm">Get set up ({completed}/{steps.length} done)</p>
          <div className="mt-1.5 h-1.5 w-48 bg-zinc-100 rounded-full">
            <div
              className="h-1.5 bg-sky-500 rounded-full transition-all"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.done ? '#' : step.href}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              step.done ? 'opacity-50 cursor-default' : 'hover:bg-zinc-50 cursor-pointer'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              step.done ? 'bg-sky-500 border-sky-500' : 'border-zinc-300'
            }`}>
              {step.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${step.done ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{step.label}</p>
              {!step.done && <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>}
            </div>
            {!step.done && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
