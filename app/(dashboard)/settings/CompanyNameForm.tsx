'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/_lib/supabase/client'

export default function CompanyNameForm({
  userId,
  initialCompany,
}: {
  userId: string
  initialCompany: string | null
}) {
  const router = useRouter()
  const [company, setCompany] = useState(initialCompany ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ company_name: company.trim() || null })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setError("Couldn't save. Try again.")
      return
    }
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Company</label>
      <input
        type="text"
        value={company}
        onChange={e => setCompany(e.target.value)}
        placeholder="Your company name"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <p className="text-xs text-zinc-600">Homeowners see this in your texts. LLC, Inc, and Corp get dropped automatically.</p>
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  )
}
