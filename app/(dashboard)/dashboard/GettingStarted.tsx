import Link from 'next/link'

// First-run guide. Sequences the *doing*: load your notepad for instant value,
// then the real muscle — adding a customer in person with consent so Hailey
// auto-books. Renders only until both are done, then it's gone (no clutter).
export default function GettingStarted({ homeownerCount, optedInCount }: { homeownerCount: number; optedInCount: number }) {
  const loadedList = homeownerCount > 0
  const addedConsent = optedInCount > 0
  if (loadedList && addedConsent) return null

  return (
    <div className="mb-6 bg-zinc-900 rounded-2xl border border-sky-500/30 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sky-400 text-xs font-bold tracking-widest uppercase">Start here</span>
      </div>
      <h2 className="text-lg font-bold text-white mb-4">Two moves and SIP is working for you</h2>

      <div className="flex flex-col gap-3">
        <Step
          done={loadedList}
          n={1}
          title="Load your notepad"
          body="Import every past customer and lead you've got — a spreadsheet, a screenshot, even a photo of your handwritten notepad. We read it and sort out who's who. They get watched, and the moment a storm hits one it comes back to you as a lead to call. Instant value from people you already know."
          href="/homeowners/import"
          cta="Import your list"
        />
        <Step
          done={addedConsent}
          n={2}
          title="Add a customer in person"
          body="This is the one that pays. Get their OK to text, add them, and when a storm hits Hailey texts them, books the inspection, and drops it on your calendar. You just show up."
          href="/homeowners/new"
          cta="Add a customer"
        />
      </div>
    </div>
  )
}

function Step({ done, n, title, body, href, cta }: { done: boolean; n: number; title: string; body: string; href: string; cta: string }) {
  return (
    <div className={`flex gap-3.5 p-4 rounded-xl border transition-colors ${done ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-700'}`}>
      <div className={`mt-0.5 h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : 'bg-sky-500/15 text-sky-400 border border-sky-500/40'}`}>
        {done ? '✓' : n}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{title}</p>
        {!done && (
          <>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{body}</p>
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 mt-3 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors"
            >
              {cta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
