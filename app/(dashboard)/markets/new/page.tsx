'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const DAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
]

export default function NewMarketPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [zipInput, setZipInput] = useState('')
  const [zips, setZips] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleDay(day: number) {
    setWorkingDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day].sort())
  }

  function addZip() {
    const trimmed = zipInput.trim()
    if (trimmed.match(/^\d{5}$/) && !zips.includes(trimmed)) { setZips(z => [...z, trimmed]); setZipInput('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Market name is required.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: market, error: marketError } = await supabase.from('markets').insert({
      roofer_id: user!.id, name: name.trim(), auto_schedule: autoSchedule,
      working_days: workingDays, working_hours_start: startTime, working_hours_end: endTime,
    }).select().single()

    if (marketError) { setError(marketError.message); setLoading(false); return }
    if (zips.length > 0) await supabase.from('market_zips').insert(zips.map(zip => ({ market_id: market.id, zip_code: zip })))

    router.push('/markets')
    router.refresh()
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500"

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/markets" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Markets</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-8">Add market</h1>

      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Market name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tucson" required className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Scheduling</label>
          <div className="flex flex-col gap-3">
            {[
              { val: true, title: 'Auto-schedule', desc: 'Homeowner replies YES → inspection booked automatically' },
              { val: false, title: 'Manual scheduling', desc: 'Homeowner replies YES → you get a notification to call them' },
            ].map(opt => (
              <label key={String(opt.val)} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${autoSchedule === opt.val ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-700 hover:border-zinc-600'}`}>
                <input type="radio" checked={autoSchedule === opt.val} onChange={() => setAutoSchedule(opt.val)} className="mt-0.5 accent-sky-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{opt.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {autoSchedule && (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Working days</label>
              <div className="flex gap-2">
                {DAYS.map(d => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${workingDays.includes(d.value) ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Start time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">End time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass} />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">ZIP codes</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={zipInput} onChange={e => setZipInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZip() } }}
              maxLength={5} placeholder="85701" className={inputClass} />
            <button type="button" onClick={addZip} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors">Add</button>
          </div>
          {zips.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {zips.map(zip => (
                <span key={zip} className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">
                  {zip}
                  <button type="button" onClick={() => setZips(z => z.filter(x => x !== zip))} className="text-zinc-600 hover:text-zinc-300">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
          {loading ? 'Saving...' : 'Create market'}
        </button>
      </form>
    </div>
  )
}
