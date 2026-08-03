'use client'

import { useState } from 'react'

// Shown while `billing_state = 'past_due'`. The customer keeps FULL access during
// Stripe's retry window — this is the only thing telling them a card failed, so it
// has to be visible without being a paywall.
export default function BillingBanner() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function openPortal() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (url) {
        window.location.href = url
        return
      }
      setError(error ?? 'Could not open billing. Try again in a moment.')
    } catch {
      setError('Could not open billing. Try again in a moment.')
    }
    setLoading(false)
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-300">Your last payment didn&apos;t go through</p>
        <p className="text-xs text-amber-200/70 mt-0.5">
          Nothing has been switched off. Your homeowners are still being monitored and texted while
          we retry the card. Update it to stay ahead of it.
        </p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <button
        onClick={openPortal}
        disabled={loading}
        className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Opening…' : 'Update card'}
      </button>
    </div>
  )
}
