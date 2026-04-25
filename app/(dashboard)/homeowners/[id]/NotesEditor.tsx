'use client'

import { useState } from 'react'

export default function NotesEditor({ homeownerId, initial }: { homeownerId: string; initial: string | null }) {
  const [notes, setNotes] = useState(initial ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function save() {
    if (notes === (initial ?? '')) return
    setStatus('saving')
    await fetch(`/api/homeowners/${homeownerId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setStatus('idle') }}
        onBlur={save}
        placeholder="Roof age, condition notes, who to call, anything useful..."
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-700 resize-none"
      />
      <p className="text-xs text-zinc-600 mt-1">
        {status === 'saving' ? 'Saving...' : status === 'saved' ? '✓ Saved' : 'Auto-saves on blur'}
      </p>
    </div>
  )
}
