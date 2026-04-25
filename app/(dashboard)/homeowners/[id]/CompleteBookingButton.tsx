'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CompleteBookingButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    if (!confirm('Mark as complete? A thank-you text will be sent to the homeowner.')) return
    setLoading(true)
    await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' })
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors disabled:opacity-50"
    >
      {loading ? 'Completing...' : 'Mark complete ✓'}
    </button>
  )
}
