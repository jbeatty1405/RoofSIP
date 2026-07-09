'use client'

import { useEffect, useMemo, useState } from 'react'

type UserRow = {
  id: string
  email: string
  pm_name: string | null
  company_name: string | null
  pm_phone: string | null
  pm_email: string | null
  subscription_status: string | null
  created_at: string
  sms_used: number
  sms_cap: number
  homeowners: number
  bookings: number
  stripe_status: string | null
  monthly_amount: number | null // cents
  trial_end: number | null // unix seconds
  period_end: number | null // unix seconds
}

type Filter = 'all' | 'paying' | 'trialing' | 'never_paid' | 'dormant'

const DAY = 86400
const now = () => Math.floor(Date.now() / 1000)

function fmtDate(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function daysFromNow(unix: number | null): number | null {
  if (!unix) return null
  return Math.round((unix - now()) / DAY)
}
function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (DAY * 1000))
}

// A row's true billing state. Stripe status wins; fall back to profile flag.
function billingKind(u: UserRow): 'paying' | 'trialing' | 'past_due' | 'canceled' | 'never_paid' {
  if (u.stripe_status === 'active') return 'paying'
  if (u.stripe_status === 'trialing') return 'trialing'
  if (u.stripe_status === 'past_due' || u.stripe_status === 'unpaid') return 'past_due'
  if (u.stripe_status === 'canceled' || u.stripe_status === 'incomplete_expired') return 'canceled'
  return 'never_paid' // no Stripe sub at all
}

const BADGE: Record<string, string> = {
  paying: 'bg-green-500/15 text-green-400 border border-green-500/30',
  trialing: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  past_due: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  canceled: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
  never_paid: 'bg-red-500/10 text-red-400 border border-red-500/25',
}
const BADGE_LABEL: Record<string, string> = {
  paying: 'Paying',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  never_paid: 'Never paid',
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleAction(email: string, action: 'activate' | 'deactivate') {
    setActionLoading(email)
    setMessage('')
    const res = await fetch('/api/admin/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action }),
    })
    const data = await res.json()
    if (data.ok) {
      setMessage(`✓ ${email} ${action}d`)
      await loadUsers()
    } else {
      setMessage(`✗ ${data.error}`)
    }
    setActionLoading('')
  }

  const stats = useMemo(() => {
    const paying = users.filter(u => billingKind(u) === 'paying')
    const trialing = users.filter(u => billingKind(u) === 'trialing').length
    const pastDue = users.filter(u => billingKind(u) === 'past_due').length
    const neverPaid = users.filter(u => billingKind(u) === 'never_paid').length
    const new7 = users.filter(u => ageDays(u.created_at) <= 7).length
    const mrr = paying.reduce((sum, u) => sum + (u.monthly_amount ?? 0), 0) / 100
    // Live subscriber count = anyone with a non-canceled Stripe sub (paying,
    // in trial, or past due). This is the number that should match Stripe's
    // active-subscription count. Test logins (e.g. playwright-test) have no
    // profile row, so they never appear here.
    const subscribers = paying.length + trialing + pastDue
    return { paying: paying.length, trialing, pastDue, neverPaid, new7, mrr, subscribers }
  }, [users])

  const filtered = useMemo(() => users.filter(u => {
    const kind = billingKind(u)
    if (filter === 'paying' && kind !== 'paying') return false
    if (filter === 'trialing' && kind !== 'trialing') return false
    if (filter === 'never_paid' && kind !== 'never_paid') return false
    // dormant = has access (paying/trial) but hasn't loaded homeowners
    if (filter === 'dormant' && !((kind === 'paying' || kind === 'trialing') && u.homeowners === 0)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.company_name ?? '').toLowerCase().includes(q) ||
      (u.pm_name ?? '').toLowerCase().includes(q) ||
      (u.pm_phone ?? '').includes(q)
    )
  }), [users, filter, search])

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${users.length}` },
    { key: 'paying', label: `Paying ${stats.paying}` },
    { key: 'trialing', label: `Trial ${stats.trialing}` },
    { key: 'never_paid', label: `Never paid ${stats.neverPaid}` },
    { key: 'dormant', label: 'Dormant' },
  ]

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Stat label="Subscribers" value={String(stats.subscribers)} accent="text-white" hint="matches Stripe" />
        <Stat label="MRR" value={`$${stats.mrr.toFixed(0)}`} accent="text-green-400" />
        <Stat label="Paying" value={String(stats.paying)} accent="text-green-400" />
        <Stat label="On trial" value={String(stats.trialing)} accent="text-sky-400" />
        <Stat label="New · 7d" value={String(stats.new7)} accent="text-white" />
      </div>

      {message && (
        <p className={`text-sm mb-3 ${message.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
      )}

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === c.key ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {c.label}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, company, email, phone…"
          className="ml-auto flex-1 min-w-[200px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-600 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map(u => {
              const kind = billingKind(u)
              const trialDays = kind === 'trialing' ? daysFromNow(u.trial_end) : null
              const busy = actionLoading === u.email
              return (
                <div key={u.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">
                          {u.company_name || u.pm_name || u.email}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${BADGE[kind]}`}>
                          {BADGE_LABEL[kind]}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {[u.pm_name, u.email].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {[
                          u.pm_phone ? `📞 ${u.pm_phone}` : null,
                          `signed up ${fmtDate(Math.floor(new Date(u.created_at).getTime() / 1000))}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {kind === 'trialing' && trialDays !== null && (
                        <span className="text-[11px] text-sky-400">
                          {trialDays > 0 ? `first charge in ${trialDays}d` : 'trial ending'} · {fmtDate(u.trial_end)}
                        </span>
                      )}
                      {kind === 'paying' && (
                        <span className="text-[11px] text-green-400">
                          ${((u.monthly_amount ?? 0) / 100).toFixed(0)}/mo · renews {fmtDate(u.period_end)}
                        </span>
                      )}
                      {u.subscription_status === 'active' ? (
                        <button
                          onClick={() => handleAction(u.email, 'deactivate')}
                          disabled={busy}
                          className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          {busy ? '…' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(u.email, 'activate')}
                          disabled={busy}
                          className="text-xs text-sky-500 hover:text-sky-400 transition-colors disabled:opacity-40"
                        >
                          {busy ? '…' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Engagement strip */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500">
                    <span className={u.homeowners === 0 ? 'text-amber-500/80' : ''}>
                      🏠 {u.homeowners} homeowner{u.homeowners === 1 ? '' : 's'}
                    </span>
                    <span>📅 {u.bookings} booking{u.bookings === 1 ? '' : 's'}</span>
                    <span>💬 {u.sms_used}/{u.sms_cap} SMS</span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-zinc-600 text-sm">No customers match</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600 mt-0.5">{hint}</div>}
    </div>
  )
}
