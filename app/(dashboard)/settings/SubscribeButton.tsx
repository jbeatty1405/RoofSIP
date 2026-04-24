'use client'

import { useState } from 'react'

export default function SubscribeButton({ userId, stripeCustomerId }: { userId: string; stripeCustomerId?: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
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
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Loading...' : 'Subscribe — $20/month'}
    </button>
  )
}
