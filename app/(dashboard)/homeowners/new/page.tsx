'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

type AddressSuggestion = { address: string; zipCode: string }

export default function NewHomeownerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', address: '', zipCode: '' })
  const [marketId, setMarketId] = useState('')
  const [markets, setMarkets] = useState<{ id: string; name: string }[]>([])
  const [monitorOnly, setMonitorOnly] = useState<boolean | null>(null)
  const [tcpaConsent, setTcpaConsent] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadMarkets() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('markets').select('id, name').eq('roofer_id', user.id).order('name')
      setMarkets(data ?? [])
    }
    loadMarkets()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 4) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(q)}`)
        const data: AddressSuggestion[] = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
        setActiveSuggestion(-1)
      } catch { /* ignore */ }
    }, 300)
  }, [])

  function handleAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    set('address', val)
    fetchSuggestions(val)
  }

  function selectSuggestion(s: AddressSuggestion) {
    setForm(f => ({ ...f, address: s.address, zipCode: s.zipCode }))
    setSuggestions([])
    setShowSuggestions(false)
    setActiveSuggestion(-1)
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeSuggestion])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (monitorOnly === null) { setError('Select how you want to add this homeowner.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const photoUrls: string[] = []
    for (const photo of photos) {
      const ext = photo.name.split('.').pop()
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('homeowner-photos').upload(path, photo)
      if (!uploadError) {
        const { data } = supabase.storage.from('homeowner-photos').getPublicUrl(path)
        photoUrls.push(data.publicUrl)
      }
    }

    const res = await fetch('/api/homeowners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, photoUrls, tcpaConsent: monitorOnly ? false : tcpaConsent, monitorOnly: monitorOnly === true, marketId: marketId || null }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
    } else if (data.smsError) {
      setError(`Homeowner added but SMS failed: ${data.smsError}`)
      setLoading(false)
    } else {
      router.push(data.deferred ? '/homeowners?deferred=1' : '/homeowners')
      router.refresh()
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Homeowners</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Add homeowner</h1>
      <p className="text-sm text-zinc-500 mb-8">Add a homeowner to monitor their roof for storm activity.</p>

      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 flex flex-col gap-5">

        {/* Mode selector — required */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">How are you adding this person?</p>
          <div className="flex flex-col gap-2">

            <label className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${monitorOnly === false ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-700 hover:border-zinc-600'}`}>
              <input
                type="radio"
                name="add-mode"
                checked={monitorOnly === false}
                onChange={() => setMonitorOnly(false)}
                className="mt-0.5 accent-sky-500 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-200">Verbal consent given</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  They've agreed to hear from you — new customer, door knock, referral. Hailey will text them automatically when a storm hits their area.
                </p>
              </div>
            </label>

            <label className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${monitorOnly === true ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-700 hover:border-zinc-600'}`}>
              <input
                type="radio"
                name="add-mode"
                checked={monitorOnly === true}
                onChange={() => { setMonitorOnly(true); setTcpaConsent(false) }}
                className="mt-0.5 accent-amber-500 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-200">Monitor only — no consent yet</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Old customer, notebook lead, or someone you haven't talked to yet. No texts will be sent. You'll get a notification when a storm hits so you can call them directly.
                </p>
              </div>
            </label>

          </div>
        </div>

        <div>
          <label htmlFor="ho-name" className="block text-sm font-medium text-zinc-300 mb-1.5">Full name</label>
          <input id="ho-name" type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputClass} placeholder="Sarah Johnson" />
        </div>
        <div>
          <label htmlFor="ho-phone" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Phone number{monitorOnly === true && <span className="text-zinc-500 font-normal"> (optional)</span>}
          </label>
          <input id="ho-phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required={monitorOnly !== true} placeholder="+1 (555) 000-0000" className={inputClass} />
          {monitorOnly === true && (
            <p className="text-xs text-zinc-500 mt-1.5">Leave blank if you only have the address — you'll still get a hot lead to call when a storm hits.</p>
          )}
        </div>
        <div className="relative">
          <label htmlFor="ho-address" className="block text-sm font-medium text-zinc-300 mb-1.5">Address</label>
          <input
            id="ho-address"
            ref={addressRef}
            type="text"
            value={form.address}
            onChange={handleAddressChange}
            onKeyDown={handleAddressKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            required
            placeholder="123 Main St, Tucson, AZ"
            className={inputClass}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => selectSuggestion(s)}
                  className={`px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${i === activeSuggestion ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-300 hover:bg-zinc-700'}`}
                >
                  {s.address}
                  {s.zipCode && <span className="ml-2 text-xs text-zinc-500">{s.zipCode}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="ho-zip" className="block text-sm font-medium text-zinc-300 mb-1.5">ZIP code</label>
          <input id="ho-zip" type="text" value={form.zipCode} onChange={e => set('zipCode', e.target.value)} required maxLength={5} pattern="[0-9]{5}" placeholder="85701" className={inputClass} />
        </div>

        <div>
          <label htmlFor="ho-market" className="block text-sm font-medium text-zinc-300 mb-1.5">Market</label>
          <select id="ho-market" value={marketId} onChange={e => setMarketId(e.target.value)} className={inputClass}>
            <option value="">No market</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Roof photos</label>
          <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-sky-500 transition-colors">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Click to upload photos</p>
              <p className="text-xs text-zinc-600 mt-0.5">JPG, PNG, HEIC</p>
            </div>
            <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-zinc-700" />
              ))}
            </div>
          )}
        </div>

        {monitorOnly === false && (
          <label className="flex gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tcpaConsent}
              onChange={e => setTcpaConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-zinc-900 shrink-0"
            />
            <span className="text-xs text-zinc-400 leading-relaxed">
              I confirm this homeowner has given me express written consent to receive automated text messages about storm alerts and free roof inspections from my company. They were told that msg &amp; data rates may apply and that they can reply <strong className="text-zinc-300">STOP</strong> at any time to opt out. <em>Checking this box will send an introductory text immediately.</em>
            </span>
          </label>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
          {loading ? 'Adding...' : monitorOnly === true ? 'Add to monitoring' : 'Add homeowner'}
        </button>
      </form>
    </div>
  )
}
