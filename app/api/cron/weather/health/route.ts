import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/_lib/supabase/server'

// The storm check runs every 10 minutes and writes a heartbeat when a run makes
// it all the way through. Older than this means it has stopped (Vercel cron not
// firing, or every run dying partway), and nobody would otherwise know.
const STALE_AFTER_MIN = 30

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('rate_limit_events')
    .select('created_at')
    .eq('action', 'cron_weather_done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ healthy: false, error: error.message }, { status: 503 })

  const last = data?.created_at ?? null
  const minutesAgo = last ? Math.round((Date.now() - Date.parse(last)) / 60000) : null
  const healthy = minutesAgo !== null && minutesAgo <= STALE_AFTER_MIN
  return NextResponse.json(
    { healthy, last_completed_at: last, minutes_ago: minutesAgo, stale_after_min: STALE_AFTER_MIN },
    { status: healthy ? 200 : 503 },
  )
}
