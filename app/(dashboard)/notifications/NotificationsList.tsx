'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export type Notification = {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
  dismissed_at: string | null
  homeowner_id: string | null
  homeowners: { name: string; phone: string; address: string } | null
}

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

export default function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [showHandled, setShowHandled] = useState(false)
  const [undo, setUndo] = useState<string[] | null>(null)

  const active = notifications.filter(n => !n.dismissed_at)
  const handled = notifications.filter(n => n.dismissed_at)

  const hotLeads = active.filter(n => n.type === 'hot_lead')
  const booked = active.filter(n => n.type === 'booking_confirmed')
  // Anything not otherwise classified is a call to make; admin_alert is an owner
  // alert (new subscriber, trial converted) and isn't a lead at all.
  const callsNeeded = active.filter(
    n => !['hot_lead', 'booking_confirmed', 'admin_alert'].includes(n.type),
  )
  const allSelected = active.length > 0 && selected.size === active.length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function dismiss(ids: string[]) {
    if (!ids.length) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString(), read: true })
      .in('id', ids)
    setBusy(false)

    if (error) { alert(`Could not dismiss: ${error.message}`); return }

    setSelected(new Set())
    setUndo(ids)
    router.refresh()
  }

  async function restore(ids: string[]) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ dismissed_at: null })
      .in('id', ids)
    setBusy(false)

    if (error) { alert(`Could not undo: ${error.message}`); return }

    setUndo(null)
    router.refresh()
  }

  function Card({ n, accent, badge, dimmed }: {
    n: Notification
    accent: string
    badge?: { label: string; className: string }
    dimmed?: boolean
  }) {
    const isSelected = selected.has(n.id)

    return (
      <div
        className={`bg-zinc-900 rounded-xl border p-5 transition-colors ${
          isSelected ? 'border-sky-500/60 bg-sky-500/5' : accent
        } ${dimmed ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-4">
          {!dimmed && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(n.id)}
              aria-label={`Select notification for ${n.homeowners?.name ?? 'homeowner'}`}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-sky-500"
            />
          )}

          <div className="flex-1 min-w-0">
            {badge && !dimmed && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            )}

            {n.homeowner_id ? (
              <Link
                href={`/homeowners/${n.homeowner_id}`}
                className="block text-sm font-semibold text-zinc-200 hover:text-white hover:underline mt-2"
              >
                {n.homeowners?.name ?? 'Unknown homeowner'}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-zinc-200 mt-2">{n.homeowners?.name ?? 'Unknown'}</p>
            )}

            {n.homeowners?.phone && (
              <a
                href={`tel:${n.homeowners.phone}`}
                className="text-base font-bold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5 mt-1"
              >
                <PhoneIcon />
                {n.homeowners.phone}
              </a>
            )}

            <p className="text-xs text-zinc-600 mt-0.5">{n.homeowners?.address}</p>
            <p className="text-sm text-zinc-400 mt-2">{n.message}</p>
            {/* toLocaleString resolves against the viewer's timezone, which the server can't know */}
            <p className="text-xs text-zinc-600 mt-2" suppressHydrationWarning>
              {new Date(n.created_at).toLocaleString()}
            </p>
          </div>

          {dimmed ? (
            <button
              onClick={() => restore([n.id])}
              disabled={busy}
              className="shrink-0 text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => dismiss([n.id])}
              disabled={busy}
              className="shrink-0 text-sm font-medium text-sky-400 hover:text-sky-300 border border-sky-500/30 px-3 py-1.5 rounded-lg hover:bg-sky-500/10 transition-colors disabled:opacity-50"
            >
              Mark handled
            </button>
          )}
        </div>
      </div>
    )
  }

  if (active.length === 0 && handled.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-16 text-center">
        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <p className="text-zinc-200 font-semibold text-sm">You&apos;re all caught up</p>
        <p className="text-zinc-600 text-xs mt-1">Notifications appear here when homeowners respond.</p>
      </div>
    )
  }

  return (
    <>
      {active.length > 0 && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(active.map(n => n.id)))}
              className="h-4 w-4 cursor-pointer accent-sky-500"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>

          {selected.size > 0 && (
            <button
              onClick={() => dismiss([...selected])}
              disabled={busy}
              className="text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? 'Working...' : `Mark ${selected.size} handled`}
            </button>
          )}
        </div>
      )}

      {undo && (
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4">
          <span className="text-sm text-zinc-300">
            {undo.length === 1 ? '1 notification handled' : `${undo.length} notifications handled`}
          </span>
          <button
            onClick={() => restore(undo)}
            disabled={busy}
            className="text-sm font-bold text-sky-400 hover:text-sky-300 disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}

      {hotLeads.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Hot leads</h2>
          </div>
          <div className="flex flex-col gap-3">
            {hotLeads.map(n => (
              <Card
                key={n.id}
                n={n}
                accent="border-red-500/30"
                badge={{ label: 'Call them', className: 'text-red-400 bg-red-500/10' }}
              />
            ))}
          </div>
        </div>
      )}

      {booked.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">Booked</h2>
          </div>
          <div className="flex flex-col gap-3">
            {booked.map(n => (
              <Card
                key={n.id}
                n={n}
                accent="border-green-500/30"
                badge={{ label: 'Inspection booked', className: 'text-green-400 bg-green-500/10' }}
              />
            ))}
          </div>
        </div>
      )}

      {callsNeeded.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Calls needed</h2>
          </div>
          <div className="flex flex-col gap-3">
            {callsNeeded.map(n => (
              <Card
                key={n.id}
                n={n}
                accent="border-amber-500/30"
                badge={{ label: 'Call to schedule', className: 'text-amber-400 bg-amber-500/10' }}
              />
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && handled.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center mb-8">
          <p className="text-zinc-200 font-semibold text-sm">All caught up</p>
          <p className="text-zinc-600 text-xs mt-1">Every notification has been handled.</p>
        </div>
      )}

      {handled.length > 0 && (
        <div>
          <button
            onClick={() => setShowHandled(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 hover:text-zinc-300 transition-colors"
          >
            <span className={`transition-transform ${showHandled ? 'rotate-90' : ''}`}>›</span>
            Handled ({handled.length})
          </button>
          {showHandled && (
            <div className="flex flex-col gap-2">
              {handled.map(n => (
                <Card key={n.id} n={n} accent="border-zinc-800" dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
