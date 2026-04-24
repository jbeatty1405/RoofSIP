'use client'

import { useState } from 'react'
import { createClient } from '@/app/_lib/supabase/client'

export default function PmContactForm({
  userId,
  initialPhone,
  initialEmail,
}: {
  userId: string
  initialPhone: string | null
  initialEmail: string | null
}) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    await supabase.from('profiles').update({ pm_phone: phone, pm_email: email }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Used to send you booking confirmations and route homeowner replies to you directly.
      </p>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Your phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Your email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </div>
  )
}
