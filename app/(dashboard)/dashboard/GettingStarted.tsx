import Link from 'next/link'

// First-run guide. Mirrors the mobile checklist (same two targets, same story):
// get roofs on watch for instant value, then the real muscle — homeowners who
// gave consent, so Hailey auto-books. Desktop keeps its own step 1 destination:
// bulk import is the whole point of being at a computer.
const WATCH_GOAL = 5
const CONSENT_GOAL = 3

export default function GettingStarted({ homeownerCount, optedInCount }: { homeownerCount: number; optedInCount: number }) {
  if (homeownerCount >= WATCH_GOAL && optedInCount >= CONSENT_GOAL) return null

  return (
    <div className="mb-6 bg-zinc-900 rounded-2xl border border-sky-500/30 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sky-400 text-xs font-bold tracking-widest uppercase">Start here</span>
      </div>
      <h2 className="text-lg font-bold text-white mb-4">Two moves and SIP is working for you</h2>

      <div className="flex flex-col gap-3">
        <Step
          n={1}
          count={homeownerCount}
          goal={WATCH_GOAL}
          title="Put 5 roofs on watch"
          body="The houses you already looked at that didn't have enough damage to file yet, plus the jobs you've done. Drop in a spreadsheet, a screenshot, even a photo of your handwritten notepad and we'll sort out who's who. No permission to text needed. Those roofs get watched, and the moment a storm hits one it comes back to you as a lead to call."
          href="/homeowners/import"
          cta="Import your list"
        />
        <Step
          n={2}
          count={optedInCount}
          goal={CONSENT_GOAL}
          title="Get 3 of them on text"
          body="This is the one that pays. When a homeowner gives you the OK to text, add them with consent. A storm hits and Hailey texts them, books the inspection, and drops it on your calendar. You just show up."
          href="/homeowners/new?mode=consent"
          cta="Add with consent"
        />
      </div>
    </div>
  )
}

function Step({ n, count, goal, title, body, href, cta }: { n: number; count: number; goal: number; title: string; body: string; href: string; cta: string }) {
  const done = count >= goal
  const pct = Math.min(100, Math.round((count / goal) * 100))
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
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] font-bold text-zinc-500 shrink-0">{Math.min(count, goal)} of {goal}</span>
            </div>
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
