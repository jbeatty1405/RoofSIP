'use client'

import { useEffect, useState } from 'react'

type UserRow = {
  id: string
  email: string
  pm_name: string | null
  company_name: string | null
  subscription_status: string | null
  stripe_customer_id: string | null
  created_at: string
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionEmail, setActionEmail] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleAction(email: string, action: 'activate' | 'deactivate') {
    setActionLoading(true)
    setMessage('')
    const res = await fetch('/api/admin/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action }),
    })
    const data = await res.json()
    if (data.ok) {
      setMessage(`✓ ${email} ${action}d`)
      loadUsers()
    } else {
      setMessage(`✗ ${data.error}`)
    }
    setActionLoading(false)
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.pm_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Quick activate by email */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Activate by email</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={actionEmail}
            onChange={e => setActionEmail(e.target.value)}
            placeholder="contractor@example.com"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={() => handleAction(actionEmail, 'activate')}
            disabled={!actionEmail || actionLoading}
            className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
          >
            Activate
          </button>
          <button
            onClick={() => handleAction(actionEmail, 'deactivate')}
            disabled={!actionEmail || actionLoading}
            className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
          >
            Deactivate
          </button>
        </div>
        {message && (
          <p className={`text-sm mt-2 ${message.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
        )}
      </div>

      {/* User list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, name, or company…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-600 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{u.email}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {[u.pm_name, u.company_name].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.subscription_status === 'active'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {u.subscription_status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  {u.subscription_status === 'active' ? (
                    <button
                      onClick={() => handleAction(u.email, 'deactivate')}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(u.email, 'activate')}
                      className="text-xs text-sky-500 hover:text-sky-400 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-zinc-600 text-sm">No users found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
