'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Live toggle for whether a homeowner gets texted or just watched silently.
// Same pattern as SchedulingToggle: optimistic write straight to the row, revert on failure.
//
// Switching TO monitor-only is always allowed and needs no ceremony — that's the
// common case (a homeowner who's had enough of the texts).
//
// Switching BACK to texting is gated on consent, and not as paperwork: the storm cron
// (app/api/weather/route.ts) reads three disjoint sets — active needs
// tcpa_consent && sms_confirmed && !monitor_only, unconfirmed needs tcpa_consent &&
// !monitor_only, watch-only needs monitor_only. Clearing monitor_only on a row with
// tcpa_consent=false matches NONE of them: the homeowner silently stops being texted
// AND stops being watched. So a homeowner who has never consented (added monitor-only,
// or replied STOP) gets the same consent checkbox the add form uses, and we set
// tcpa_consent with it. The hourly cron then sends the intro text, respecting their
// local quiet hours.
export default function MonitoringToggle({ homeownerId, initial, hasPhone, hasConsent }: { homeownerId: string; initial: boolean; hasPhone: boolean; hasConsent: boolean }) {
  const [monitorOnly, setMonitorOnly] = useState(initial)
  const [consented, setConsented] = useState(hasConsent)
  const [asking, setAsking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)
  const router = useRouter()

  async function commit(value: boolean, grantConsent: boolean) {
    const prevMonitor = monitorOnly
    const prevConsent = consented
    setMonitorOnly(value); setSaving(true); setErr(false)
    if (grantConsent) setConsented(true)
    const patch: Record<string, unknown> = { monitor_only: value }
    if (grantConsent) {
      patch.tcpa_consent = true
      patch.tcpa_consent_at = new Date().toISOString()
    }
    const { error } = await createClient().from('homeowners').update(patch).eq('id', homeownerId)
    setSaving(false)
    if (error) { setMonitorOnly(prevMonitor); setConsented(prevConsent); setErr(true); return }
    setAsking(false); setChecked(false)
    // The Scheduling card on this page is server-rendered off monitor_only, so the
    // toggle alone would leave it stale until a manual reload.
    router.refresh()
  }

  function choose(value: boolean) {
    if (saving) return
    if (value) { setAsking(false); setChecked(false); if (!monitorOnly) commit(true, false); return }
    if (!monitorOnly) return
    if (!hasPhone) return
    // Already consented (e.g. flipped to watch-only earlier and now coming back) —
    // no need to re-ask.
    if (consented) { commit(false, false); return }
    setAsking(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <Option label="Actively texting" desc="Gets storm alerts and scheduling texts." active={!monitorOnly} onClick={() => choose(false)} disabled={monitorOnly && !hasPhone} />
      <Option label="Monitor only" desc="Watched for storm activity, but never texted." active={monitorOnly} onClick={() => choose(true)} />

      {monitorOnly && !hasPhone && (
        <p className="text-xs text-zinc-600">No phone number on file, so this one can only be watched.</p>
      )}

      {asking && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-4 flex flex-col gap-3">
          <label className="flex gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
            />
            <span className="text-xs text-zinc-500 leading-relaxed">
              I confirm this homeowner has given me express written consent to receive automated text messages about storm alerts and free roof inspections from my company. They were told that msg &amp; data rates may apply and that they can reply <strong className="text-zinc-300">STOP</strong> at any time to opt out.
            </span>
          </label>
          <p className="text-xs text-zinc-600">They&apos;ll get an introductory text within the hour, during their local daytime.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!checked || saving}
              onClick={() => commit(false, true)}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-sky-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Switching…' : 'Switch to texting'}
            </button>
            <button
              type="button"
              onClick={() => { setAsking(false); setChecked(false) }}
              className="text-sm px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && <p className="text-xs text-red-400">Couldn&apos;t save — try again.</p>}
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
