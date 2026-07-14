'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/app/_components/Logo'

type Status = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Grab the URL bits before creating the client — supabase-js strips the recovery
    // tokens out of the URL as soon as it initializes.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const supabase = createClient()

    async function establishSession() {
      const linkError = hash.get('error_description') ?? query.get('error_description')
      if (linkError) {
        setError(linkError)
        setStatus('invalid')
        return
      }

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = query.get('code')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          setError(error.message)
          setStatus('invalid')
          return
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setError(error.message)
          setStatus('invalid')
          return
        }
      }

      // Either we just set it, or supabase-js already consumed the link on init.
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError('This reset link is invalid or has expired. Request a new one.')
        setStatus('invalid')
        return
      }

      // Don't leave the tokens sitting in the address bar.
      window.history.replaceState({}, '', '/reset-password')
      setStatus('ready')
    }

    establishSession()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    // Sign the recovery session out so the next sign-in actually exercises the new password.
    await supabase.auth.signOut()
    setStatus('done')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo size="lg" />
        </div>

        {status === 'checking' && (
          <p className="text-sm text-zinc-500">Checking your reset link...</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="text-2xl font-bold text-zinc-900">Link expired</h1>
            <p className="text-zinc-500 text-sm mt-1 mb-4">
              {error || 'This reset link is invalid or has expired.'}
            </p>
            <Link
              href="/forgot-password"
              className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Send a new link
            </Link>
          </>
        )}

        {status === 'done' && (
          <>
            <h1 className="text-2xl font-bold text-zinc-900">Password updated</h1>
            <p className="text-zinc-500 text-sm mt-1 mb-6">
              You can sign in with your new password now, here or in the RoofSIP app.
            </p>
            <Link
              href="/login"
              className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Sign in
            </Link>
          </>
        )}

        {status === 'ready' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-zinc-900">Set a new password</h1>
              <p className="text-zinc-500 text-sm mt-1">Pick something you&apos;ll remember.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors mt-1"
              >
                {saving ? 'Saving...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
