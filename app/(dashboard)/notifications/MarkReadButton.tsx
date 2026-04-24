'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function MarkReadButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function markDone() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    router.refresh()
  }

  return (
    <button
      onClick={markDone}
      disabled={loading}
      className="shrink-0 text-sm font-medium text-sky-600 hover:text-sky-800 border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'Mark done'}
    </button>
  )
}
