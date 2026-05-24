'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/app/_components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel — desktop only */}
      <div className="hidden md:flex w-1/2 bg-zinc-900 flex-col justify-between p-12">
        <Logo size="lg" />
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Your AI roofing<br />assistant is ready.
          </h2>
          <div className="flex flex-col gap-3">
            {[
              'Monitors storms 24/7 across all your markets',
              'Texts homeowners automatically after weather events',
              'Emails you to confirm inspections — no app switching',
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
        <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} RoofSIP</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Logo size="lg" />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Sign in</h1>
            <p className="text-zinc-500 text-sm mt-1">Welcome back</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            No account?{' '}
            <Link href="/signup" className="text-sky-600 font-medium hover:underline">
              Get started
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
