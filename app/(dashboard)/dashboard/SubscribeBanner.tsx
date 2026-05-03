'use client'

import { useState } from 'react'

export default function SubscribeBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (dismissed) return null

  async function handleSubscribe() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const { url, error } = await res.json()
    if (url) {
      window.location.href = url
    } else {
      setLoading(false)
      alert(error ?? 'Could not start checkout')
    }
  }

  return (
    <div className="flex items-center justify-between bg-sky-500/10 border border-sky-500/20 rounded-xl px-5 py-3 mb-6">
      <p className="text-sm text-sky-300">
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
        <button onClick={() => setDismissed(true)} className="text-sky-600 hover:text-sky-400 text-lg leading-none">
          ×
        </button>
      </div>
    </div>
  )
}
