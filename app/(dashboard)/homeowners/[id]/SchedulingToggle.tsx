'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useState } from 'react'

// Live toggle for a homeowner's storm-scheduling behavior. Persists auto_schedule
// straight to the row (RLS: roofer owns it), optimistic with revert on failure.
export default function SchedulingToggle({ homeownerId, initial }: { homeownerId: string; initial: boolean }) {
  const [auto, setAuto] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)

  async function choose(value: boolean) {
    if (value === auto || saving) return
    const prev = auto
    setAuto(value); setSaving(true); setErr(false)
    const { error } = await createClient().from('homeowners').update({ auto_schedule: value }).eq('id', homeownerId)
    setSaving(false)
    if (error) { setAuto(prev); setErr(true) }
  }

  return (
    <div className="flex flex-col gap-2">
      <Option label="Auto schedule" desc="Texts them a time and books it automatically when they reply YES." active={auto} onClick={() => choose(true)} />
      <Option label="Generate PM call" desc="Texts them that you'll call to schedule, and adds a lead to your call list. No time is booked automatically." active={!auto} onClick={() => choose(false)} />
      {err && <p className="text-xs text-red-400">Couldn't save — try again.</p>}
    </div>
  )
}

function Option({ label, desc, active, onClick }: { label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left flex gap-3 p-4 rounded-xl border transition-colors ${active ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-700 hover:border-zinc-600'}`}
    >
      <span className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-sky-500' : 'border-zinc-600'}`}>
        {active && <span className="h-2 w-2 rounded-full bg-sky-500" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-zinc-200">{label}</span>
        <span className="block text-xs text-zinc-500 mt-0.5 leading-relaxed">{desc}</span>
      </span>
    </button>
  )
}
