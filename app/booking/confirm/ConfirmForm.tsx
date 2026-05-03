'use client'

import { useState } from 'react'

export default function ConfirmForm({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleConfirm() {
    setState('loading')
    setError('')
    const res = await fetch('/api/booking/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      setState('done')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not confirm. Please try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <p style={{ fontSize: 15, color: '#111' }}>Inspection confirmed. The homeowner has been texted their confirmation.</p>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleConfirm}
        disabled={state === 'loading'}
        style={{
          background: '#0ea5e9',
          color: 'white',
          border: 0,
          padding: '12px 28px',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: state === 'loading' ? 'wait' : 'pointer',
          opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        {state === 'loading' ? 'Confirming…' : 'Confirm this time'}
      </button>
      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </>
  )
}
