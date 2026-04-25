'use client'

import { useState } from 'react'

export default function FeedbackForm() {
  const [type, setType] = useState('Bug')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) setMessage('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {['Bug', 'Feature Request', 'Other'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              type === t
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          type === 'Bug'
            ? 'Describe what happened and what you expected...'
            : type === 'Feature Request'
            ? 'What would make RoofSIP more useful for you?'
            : 'Tell us anything on your mind...'
        }
        rows={4}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-700 resize-none"
      />

      {status === 'success' && (
        <p className="text-xs text-green-400">Sent — thanks for the feedback!</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-400">Something went wrong. Try again.</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !message.trim()}
        className="self-start px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {status === 'loading' ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
