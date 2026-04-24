'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function NewHomeownerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', phone: '', address: '', zipCode: '', tcpaConsent: false,
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tcpaConsent) {
      setError('You must confirm TCPA consent before adding this homeowner.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Upload photos to Supabase Storage
    const photoUrls: string[] = []
    for (const photo of photos) {
      const ext = photo.name.split('.').pop()
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('homeowner-photos')
        .upload(path, photo)
      if (!uploadError) {
        const { data } = supabase.storage.from('homeowner-photos').getPublicUrl(path)
        photoUrls.push(data.publicUrl)
      }
    }

    const { error } = await supabase.from('homeowners').insert({
      roofer_id: user!.id,
      name: form.name,
      phone: form.phone,
      address: form.address,
      zip_code: form.zipCode,
      tcpa_consent: true,
      tcpa_consent_at: new Date().toISOString(),
      roof_photos: photoUrls,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/homeowners')
      router.refresh()
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Homeowners
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Add homeowner</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Full name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Phone number</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            required
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            required
            placeholder="123 Main St, Tucson, AZ"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">ZIP code</label>
          <input
            type="text"
            value={form.zipCode}
            onChange={e => set('zipCode', e.target.value)}
            required
            maxLength={5}
            pattern="[0-9]{5}"
            placeholder="85701"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Roof photos</label>
          <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:border-sky-400 transition-colors">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Click to upload photos</p>
              <p className="text-xs text-zinc-400 mt-0.5">JPG, PNG, HEIC</p>
            </div>
            <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-zinc-200" />
              ))}
            </div>
          )}
        </div>

        <div className="border border-zinc-200 rounded-lg p-4">
          <label className="flex gap-3 cursor-pointer items-start">
            <input
              type="checkbox"
              checked={form.tcpaConsent}
              onChange={e => set('tcpaConsent', e.target.checked)}
              className="mt-0.5 shrink-0 accent-sky-500"
            />
            <span className="text-sm text-zinc-600">
              I confirm this homeowner has provided written consent to receive text messages about their roof and weather-related inspections.
            </span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Add homeowner'}
        </button>
      </form>
    </div>
  )
}
