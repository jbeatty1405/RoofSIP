'use client'

import { useState } from 'react'
import { createClient } from '@/app/_lib/supabase/client'

export default function ChangePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setPassword('')
    setConfirm('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">New password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Update password'}
        </button>
        {saved && <span className="text-sm text-green-400">Password updated</span>}
      </div>
    </div>
  )
}
