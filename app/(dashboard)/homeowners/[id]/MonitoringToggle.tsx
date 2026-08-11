'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useState } from 'react'

// Live toggle for whether a homeowner gets texted or just watched silently.
// Same pattern as SchedulingToggle: optimistic write straight to the row, revert on failure.
// Switching back to active texting needs a phone on file (texts can't send without one).
export default function MonitoringToggle({ homeownerId, initial, hasPhone }: { homeownerId: string; initial: boolean; hasPhone: boolean }) {
  const [monitorOnly, setMonitorOnly] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)

  async function choose(value: boolean) {
    if (value === monitorOnly || saving) return
    if (!value && !hasPhone) return
    const prev = monitorOnly
    setMonitorOnly(value); setSaving(true); setErr(false)
    const { error } = await createClient().from('homeowners').update({ monitor_only: value }).eq('id', homeownerId)
    setSaving(false)
    if (error) { setMonitorOnly(prev); setErr(true) }
  }

  return (
    <div className="flex flex-col gap-2">
      <Option label="Actively texting" desc="Gets storm alerts and scheduling texts." active={!monitorOnly} onClick={() => choose(false)} disabled={!hasPhone && monitorOnly} />
      <Option label="Monitor only" desc="Watched for storm activity, but never texted." active={monitorOnly} onClick={() => choose(true)} />
      {!hasPhone && monitorOnly && <p className="text-xs text-zinc-600">Needs a phone number on file before they can be switched back to texting.</p>}
      {err && <p className="text-xs text-red-400">Couldn't save — try again.</p>}
    </div>
  )
}

function Option({ label, desc, active, onClick, disabled }: { label: string; desc: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left flex gap-3 p-4 rounded-xl border transition-colors ${active ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-700 hover:border-zinc-600'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
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
