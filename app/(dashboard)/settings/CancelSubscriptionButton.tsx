'use client'

import { useState } from 'react'

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  async function handleClick() {
    if (!confirm('Cancel your subscription? You\'ll keep access until the end of your current billing period.')) return
    setLoading(true)
    const res = await fetch('/api/stripe/cancel', { method: 'POST' })
    const { error } = await res.json()
    if (error) {
      alert(error)
      setLoading(false)
    } else {
      setCancelled(true)
    }
  }

  if (cancelled) {
    return (
      <p className="text-sm text-amber-400">
        Cancellation scheduled — you'll keep access until the end of your billing period.
      </p>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors underline underline-offset-2"
    >
      {loading ? 'Cancelling...' : 'Cancel subscription'}
    </button>
  )
}
