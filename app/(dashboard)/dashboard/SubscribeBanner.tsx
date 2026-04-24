'use client'

import { useState } from 'react'

export default function SubscribeBanner({ userId, stripeCustomerId }: { userId: string; stripeCustomerId?: string }) {
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (dismissed) return null

  async function handleSubscribe() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, stripeCustomerId }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-5 py-3 mb-6">
      <p className="text-sm text-sky-800">
        <span className="font-semibold">Start your 60-day free trial</span> — activate to enable automatic storm alerts and SMS.
      </p>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Start free trial'}
        </button>
        <button onClick={() => setDismissed(true)} className="text-sky-400 hover:text-sky-600 text-lg leading-none">
          ×
        </button>
      </div>
    </div>
  )
}
