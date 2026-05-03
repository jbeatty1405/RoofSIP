'use client'

import { useState } from 'react'

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url, error } = await res.json()
    if (url) {
      window.location.href = url
    } else {
      setLoading(false)
      alert(error ?? 'Could not open billing portal')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-700 hover:border-zinc-600 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Loading...' : 'Manage billing'}
    </button>
  )
}
