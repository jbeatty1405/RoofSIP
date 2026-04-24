import { NextRequest, NextResponse } from 'next/server'

// Vercel cron calls this with GET every hour
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/weather`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
