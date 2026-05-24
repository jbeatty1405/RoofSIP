'use client'

import { useState } from 'react'
import Logo from '@/app/_components/Logo'

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubscribe() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const { url, error: err } = await res.json()
    if (url) {
      window.location.href = url
    } else {
      setError(err ?? 'Could not start checkout. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="mb-10">
        <Logo size="lg" />
      </div>

      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-1">Start your subscription</h1>
        <p className="text-zinc-500 text-sm mb-8">Storm monitoring and automated homeowner outreach for your crew.</p>

        <div className="bg-zinc-800/60 rounded-xl p-5 mb-6">
          <div className="flex items-end gap-1 mb-3">
            <span className="text-4xl font-extrabold text-white">$20</span>
            <span className="text-zinc-400 text-sm mb-1.5">/month</span>
          </div>
          <ul className="flex flex-col gap-2">
            {[
              '250 SMS per month included',
              'Hailey monitors storms 24/7',
              'Auto-texts homeowners after weather events',
              'Schedules inspections automatically',
              'Cancel anytime',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <span className="text-sky-400 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading...' : 'Subscribe — $20/mo'}
        </button>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Secure checkout via Stripe · Cancel anytime
        </p>
      </div>
    </div>
  )
}
