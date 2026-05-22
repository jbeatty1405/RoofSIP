'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'

const DAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]

export default function EditMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [zips, setZips] = useState<string[]>([])
  const [zipInput, setZipInput] = useState('')
  const [blockedInput, setBlockedInput] = useState('')
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: market } = await supabase
        .from('markets')
        .select('*, market_zips(zip_code)')
        .eq('id', id)
        .single()

      if (market) {
        setName(market.name)
        setAutoSchedule(market.auto_schedule)
        setWorkingDays(market.working_days)
        setStartTime(market.working_hours_start.slice(0, 5))
        setEndTime(market.working_hours_end.slice(0, 5))
        setZips(market.market_zips?.map((z: any) => z.zip_code) ?? [])
      }

      const { data: blocked } = await supabase
        .from('blocked_dates')
        .select('blocked_date')
        .eq('market_id', id)
        .order('blocked_date')
      setBlockedDates((blocked ?? []).map((b: any) => b.blocked_date))
      setLoaded(true)
    }
    load()
  }, [id])

  function toggleDay(day: number) {
    setWorkingDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day].sort())
  }

  function addZip() {
    const t = zipInput.trim()
    if (t.match(/^\d{5}$/) && !zips.includes(t)) { setZips(z => [...z, t]); setZipInput('') }
  }

  async function addBlockedDate() {
    if (!blockedInput || blockedDates.includes(blockedInput)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('blocked_dates').insert({ roofer_id: user!.id, market_id: id, blocked_date: blockedInput })
    setBlockedDates(d => [...d, blockedInput].sort())
    setBlockedInput('')
  }

  async function removeBlockedDate(date: string) {
    const supabase = createClient()
    await supabase.from('blocked_dates').delete().eq('market_id', id).eq('blocked_date', date)
    setBlockedDates(d => d.filter(x => x !== date))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    await supabase.from('markets').update({
      name, auto_schedule: autoSchedule, working_days: workingDays,
      working_hours_start: startTime, working_hours_end: endTime,
    }).eq('id', id)

    await supabase.from('market_zips').delete().eq('market_id', id)
    if (zips.length > 0) {
      await supabase.from('market_zips').insert(zips.map(zip => ({ market_id: id, zip_code: zip })))
    }

    router.push('/markets')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this market?')) return
    const supabase = createClient()
    await supabase.from('markets').delete().eq('id', id)
    router.push('/markets')
    router.refresh()
  }

  if (!loaded) return <div className="text-sm text-zinc-400 p-8">Loading...</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/markets" className="text-sm text-zinc-500 hover:text-zinc-900">← Markets</Link>
      </div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Edit market</h1>
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">Delete</button>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Market name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">Scheduling</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={autoSchedule} onChange={() => setAutoSchedule(true)} className="accent-sky-500" />
              <div>
                <p className="text-sm font-medium text-zinc-900">Auto-schedule</p>
                <p className="text-xs text-zinc-500">Homeowner replies YES → inspection booked automatically</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={!autoSchedule} onChange={() => setAutoSchedule(false)} className="accent-sky-500" />
              <div>
                <p className="text-sm font-medium text-zinc-900">Manual scheduling</p>
                <p className="text-xs text-zinc-500">Homeowner replies YES → you get a notification to call them</p>
              </div>
            </label>
          </div>
        </div>

        {autoSchedule && (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Working days</label>
              <div className="flex gap-2">
                {DAYS.map(d => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                      workingDays.includes(d.value) ? 'bg-sky-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}>{d.label}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">First available time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <p className="text-xs text-zinc-500 mt-1">The time proposed to homeowners (default 9am)</p>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">End time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">ZIP codes</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={zipInput} onChange={e => setZipInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZip() } }}
              maxLength={5} placeholder="85701"
              className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <button type="button" onClick={addZip}
              className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors">Add</button>
          </div>
          {zips.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {zips.map(zip => (
                <span key={zip} className="flex items-center gap-1 text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded-full">
                  {zip}
                  <button type="button" onClick={() => setZips(z => z.filter(x => x !== zip))} className="text-zinc-400 hover:text-zinc-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-zinc-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors">
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 mt-4">
        <h2 className="font-semibold text-zinc-900 mb-4">Blocked dates</h2>
        <div className="flex gap-2 mb-3">
          <input type="date" value={blockedInput} onChange={e => setBlockedInput(e.target.value)}
            className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <button type="button" onClick={addBlockedDate}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors">Block</button>
        </div>
        {blockedDates.length > 0 ? (
          <div className="flex flex-col gap-1">
            {blockedDates.map(date => (
              <div key={date} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
                <span className="text-sm text-zinc-700">{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                <button onClick={() => removeBlockedDate(date)} className="text-xs text-zinc-400 hover:text-red-500">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No blocked dates.</p>
        )}
      </div>
    </div>
  )
}
