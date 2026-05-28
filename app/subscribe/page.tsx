'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Logo from '@/app/_components/Logo'

function SubscribeContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/subscription-status')
      if (res.ok) {
        const { active } = await res.json()
        return active
      }
    } catch {}
    return false
  }, [])

  const pollForActivation = useCallback(async () => {
    setActivating(true)
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000))
      if (await checkStatus()) {
        router.replace('/dashboard')
        return
      }
    }
    // Webhook hasn't fired in 30s — show a message instead of blindly redirecting
    setActivating(false)
    setTimedOut(true)
  }, [router, checkStatus])

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      pollForActivation()
    } else {
      // On a fresh visit (no ?success), redirect active users straight to dashboard
      checkStatus().then(active => {
        if (active) router.replace('/dashboard')
      })
    }
  }, [searchParams, pollForActivation, checkStatus, router])

  async function handleSubscribe() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const { url, error: err } = await res.json()
    if (url) {
      window.location.href = url
    } else {
      const msg = err === 'Unauthorized'
        ? 'You must be signed in to subscribe. Please sign in and try again.'
        : err === 'Confirm your email first'
        ? 'Please confirm your email before subscribing. Check your inbox for the confirmation link.'
        : err ?? 'Could not start checkout. Try again.'
      setError(msg)
      setLoading(false)
    }
  }

  if (activating) {
    return (
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Activating your subscription…</h2>
        <p className="text-zinc-500 text-sm">This takes a few seconds. You'll be redirected automatically.</p>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Verification taking longer than expected</h2>
        <p className="text-zinc-400 text-sm mb-6">Your payment was received. Activation usually takes a few seconds but can occasionally take up to a minute. Try refreshing, or go to the dashboard now.</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors mb-3"
        >
          Go to Dashboard
        </button>
        <a href="mailto:azroofsip@gmail.com" className="block text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Contact support
        </a>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Start your subscription</h1>
      <p className="text-zinc-500 text-sm mb-8">Storm monitoring and automated homeowner outreach for your crew.</p>

      <div className="bg-zinc-800/60 rounded-xl p-5 mb-6">
        <div className="flex items-end gap-1 mb-3">
          <span className="text-4xl font-extrabold text-white">$20</span>
          <span className="text-zinc-400 text-sm mb-1.5">/month</span>
        </div>
        <ul className="flex flex-col gap-2">
          {[
            '60-day free trial — no charge today',
            '250 SMS per month included',
            'Hailey monitors storms 24/7',
            'Auto-texts homeowners after weather events',
            'Schedules inspections automatically',
            'Cancel anytime',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
              <span className="text-sky-400 mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading...' : 'Subscribe — $20/mo'}
      </button>

      <p className="text-center text-xs text-zinc-600 mt-4">
        Secure checkout via Stripe · Cancel anytime
      </p>
    </div>
  )
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="mb-10">
        <Logo size="lg" />
      </div>
      <Suspense fallback={null}>
        <SubscribeContent />
      </Suspense>
    </div>
  )
}
