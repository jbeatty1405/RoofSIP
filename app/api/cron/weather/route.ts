import { NextRequest, NextResponse } from 'next/server'
import { APP_URL } from '@/app/_lib/url'

// Vercel cron calls this with GET every hour
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use the public alias, NOT VERCEL_URL — the generated deployment URL sits
  // behind Vercel Deployment Protection (SSO), so a self-fetch to it returns a
  // 401 HTML wall and res.json() throws. That silently broke the entire
  // storm->SMS pipeline (it never ran in prod). APP_URL is the public domain.
  const res = await fetch(`${APP_URL}/api/weather`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
