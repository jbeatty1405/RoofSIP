'use client'

import { useState } from 'react'
import { createClient } from '@/app/_lib/supabase/client'

const EXAMPLES = [
  'Friendly and casual — like a neighbor, not a salesman. Short sentences.',
  'Professional and direct — get to the point quickly, respectful tone.',
  'Warm and personal — always use their name, feel like a real conversation.',
]

export default function MessageStyleForm({ userId, initial }: { userId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    await supabase.from('profiles').update({ message_style: value }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Describe how you want your storm alert texts to sound. Claude will use this to write a unique message for each homeowner.
      </p>

      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={4}
        placeholder="e.g. Friendly and casual — like a neighbor checking in. Keep it short and genuine, don't sound like a sales pitch."
        className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Quick picks</p>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setValue(ex)}
            className="text-left text-xs text-zinc-500 hover:text-sky-600 hover:underline"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save style'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  )
}
