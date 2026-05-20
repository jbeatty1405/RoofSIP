import { NextRequest, NextResponse } from 'next/server'

// Vercel cron calls this with GET every hour
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
  const res = await fetch(`${base}/api/weather`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
