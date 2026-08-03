'use client'

import { useEffect, useState } from 'react'

// DB stores working_days as 1=Mon ... 7=Sun (see jsToDbDay in _lib/markets.ts).
const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
  { n: 7, label: 'Sun' },
]

const HOURS = Array.from({ length: 24 }, (_, h) => {
  const value = `${String(h).padStart(2, '0')}:00`
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { value, label: `${hour12}${h < 12 ? 'am' : 'pm'}` }
})

type BlockedDate = { id: string; blocked_date: string }

export default function WorkingHoursForm() {
  const [loaded, setLoaded] = useState(false)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startHour, setStartHour] = useState('08:00')
  const [endHour, setEndHour] = useState('17:00')
  const [blocked, setBlocked] = useState<BlockedDate[]>([])
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/schedule')
      .then(r => r.json())
      .then(d => {
        if (d?.error) return
        setDays(d.workingDays ?? [1, 2, 3, 4, 5])
        setStartHour(d.startHour ?? '08:00')
        setEndHour(d.endHour ?? '17:00')
        setBlocked(d.blockedDates ?? [])
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  function toggleDay(n: number) {
    setDays(prev => (prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n].sort()))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    const res = await fetch('/api/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingDays: days, startHour, endHour }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not save your hours.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function addBlocked() {
    if (!newDate) return
    setError('')
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? 'Could not block that date.')
      return
    }
    if (!blocked.some(b => b.blocked_date === newDate)) {
      setBlocked(prev => [...prev, { id: data.id, blocked_date: newDate }].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)))
    }
    setNewDate('')
  }

  async function removeBlocked(id: string) {
    setError('')
    const res = await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not unblock that date.')
      return
    }
    setBlocked(prev => prev.filter(b => b.id !== id))
  }

  function formatDate(d: string) {
    return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!loaded) return <p className="text-sm text-zinc-600">Loading your hours…</p>

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-500">
        Hailey only books inspections inside these hours, and never on a day you block off.
      </p>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Working days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button
              key={d.n}
              type="button"
              onClick={() => toggleDay(d.n)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                days.includes(d.n)
                  ? 'bg-sky-500 border-sky-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Start</p>
          <select
            value={startHour}
            onChange={e => setStartHour(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">End</p>
          <select
            value={endHour}
            onChange={e => setEndHour(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-zinc-600 pb-2.5">your local time</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Blackout dates</p>
        {blocked.length > 0 ? (
          <ul className="flex flex-col gap-1.5 mb-3">
            {blocked.map(b => (
              <li key={b.id} className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2">
                <span className="text-sm text-zinc-300">{formatDate(b.blocked_date)}</span>
                <button
                  type="button"
                  onClick={() => removeBlocked(b.id)}
                  className="text-xs font-semibold text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 mb-3">No blackout dates. Block a day off and Hailey books around it.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={addBlocked}
            disabled={!newDate}
            className="bg-zinc-800 border border-zinc-700 hover:border-zinc-600 disabled:opacity-40 text-zinc-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Block this day
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors self-start"
        >
          {saving ? 'Saving…' : 'Save hours'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </div>
  )
}
