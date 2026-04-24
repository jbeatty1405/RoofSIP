'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/app/_components/Logo'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', pmName: '', companyName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { pm_name: form.pmName, company_name: form.companyName },
        emailRedirectTo: `${location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/login?message=Check your email to confirm your account')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel — desktop only */}
      <div className="hidden md:flex w-1/2 bg-zinc-900 flex-col justify-between p-12">
        <Logo size="lg" />
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Stop chasing leads.<br />Start closing jobs.
          </h2>
          <div className="flex flex-col gap-3">
            {[
              '60-day free trial — no credit card required',
              'Set up in under 10 minutes',
              'Works on any phone, any calendar',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="text-zinc-300 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-zinc-600 text-xs">© 2025 RoofSIP</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Logo size="lg" />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Create account</h1>
            <p className="text-zinc-500 text-sm mt-1">Start your 60-day free trial</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Your name</label>
                <input
                  type="text"
                  value={form.pmName}
                  onChange={e => set('pmName', e.target.value)}
                  required
                  placeholder="Mike"
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Company</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => set('companyName', e.target.value)}
                  placeholder="Smith Roofing"
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
                minLength={8}
                placeholder="8+ characters"
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors mt-1"
            >
              {loading ? 'Creating account...' : 'Start free trial'}
            </button>

            <p className="text-center text-xs text-zinc-400">
              No credit card required · Cancel anytime
            </p>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-sky-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
