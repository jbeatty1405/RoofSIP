import { NextRequest, NextResponse } from 'next/server'
import { APP_URL } from '@/app/_lib/url'

// Vercel cron calls this with GET every 10 minutes (vercel.json). GitHub Actions
// also calls it hourly as a backup and to fail loudly on blind ZIPs.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TEMPORARY KILL SWITCH (2026-06-11): the homeowners table is still test data
  // (PMs entered as fake HOs), so the storm/intro pipeline must NOT send any real
  // SMS yet. Return early so no scheduler can trigger a send. Remove this block to
  // re-enable once real homeowners exist and a deliberate go-live is approved.
  if (process.env.STORM_CRON_ENABLED !== 'true') {
    return NextResponse.json({ paused: true, reason: 'storm cron disabled pending real homeowner data' })
  }

  // Use the public alias, NOT VERCEL_URL — the generated deployment URL sits
  // behind Vercel Deployment Protection (SSO), so a self-fetch to it returns a
  // 401 HTML wall and res.json() throws. That silently broke the entire
  // storm->SMS pipeline (it never ran in prod). APP_URL is the public domain.
  const res = await fetch(`${APP_URL}/api/weather`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  // Pass trouble through as a failing status. This used to return 200 whatever
  // happened inside (paused, a failed dedup read, a 401 from /api/weather), so
  // the GitHub check stayed green on runs that did nothing.
  const data = await res.json().catch(() => ({ error: `weather returned non-JSON (HTTP ${res.status})` }))
  const benignSkip = data?.skipped && data?.reason === 'cron_rate_limited' // another run just did the work
  const failed = !res.ok || data?.paused || data?.error || (data?.skipped && !benignSkip)
  return NextResponse.json(data, { status: failed ? 500 : 200 })
}
