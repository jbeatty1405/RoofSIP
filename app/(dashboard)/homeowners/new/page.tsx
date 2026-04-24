'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function NewHomeownerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', address: '', zipCode: '' })
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      body: JSON.stringify({ ...form, photoUrls }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
    } else {
      if (data.smsError) {
        setError(`Homeowner added but SMS failed: ${data.smsError}`)
        setLoading(false)
      } else {
        router.push('/homeowners')
        router.refresh()
      }
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Homeowners</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Add homeowner</h1>
      <p className="text-sm text-zinc-500 mb-8">We'll text them to confirm they want storm alerts — no checkbox needed.</p>

      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Full name</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputClass} placeholder="Sarah Johnson" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone number</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="+1 (555) 000-0000" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Address</label>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)} required placeholder="123 Main St, Tucson, AZ" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">ZIP code</label>
          <input type="text" value={form.zipCode} onChange={e => set('zipCode', e.target.value)} required maxLength={5} pattern="[0-9]{5}" placeholder="85701" className={inputClass} />
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

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
          {loading ? 'Adding...' : 'Add homeowner'}
        </button>
      </form>
    </div>
  )
}
