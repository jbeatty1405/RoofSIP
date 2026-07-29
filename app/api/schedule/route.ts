import { createClient } from '@/app/_lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Working hours and blackout dates used to live on `markets`, which no longer has
// a UI. They're per-roofer now. `blocked_dates` grants nothing to `authenticated`,
// so every read/write here runs as service_role after the session check.
//
// NOT `createServiceClient()` from _lib/supabase/server: that one passes cookies,
// so @supabase/ssr attaches the signed-in user's JWT and it overrides the service
// key — the query then runs as `authenticated` and every blocked_dates write fails.
// This client is cookie-free, so it is actually service_role.
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, '')
  )
}

const DAY_MIN = 1 // Monday
const DAY_MAX = 7 // Sunday
const HOUR_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function hhmm(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, 5)
  return HOUR_RE.test(trimmed) ? trimmed : null
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = adminClient()
  const [{ data: profile }, { data: blocked }] = await Promise.all([
    service.from('profiles').select('working_days, working_hours_start, working_hours_end').eq('id', user.id).maybeSingle(),
    service.from('blocked_dates').select('id, blocked_date').eq('roofer_id', user.id).order('blocked_date', { ascending: true }),
  ])

  return NextResponse.json({
    workingDays: profile?.working_days ?? [1, 2, 3, 4, 5],
    startHour: (profile?.working_hours_start ?? '08:00:00').slice(0, 5),
    endHour: (profile?.working_hours_end ?? '17:00:00').slice(0, 5),
    blockedDates: blocked ?? [],
  })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const days: number[] = Array.isArray(body.workingDays)
    ? [...new Set<unknown>(body.workingDays)]
        .filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= DAY_MIN && d <= DAY_MAX)
        .sort((a, b) => a - b)
    : []
  if (days.length === 0) {
    return NextResponse.json({ error: 'Pick at least one working day.' }, { status: 400 })
  }

  const start = hhmm(body.startHour)
  const end = hhmm(body.endHour)
  if (!start || !end) return NextResponse.json({ error: 'Use a valid start and end time.' }, { status: 400 })
  // A slot is an hour long and must finish by the end time, so the day needs
  // at least an hour in it or getNextAvailableSlot can never place anything.
  if (Number(end.slice(0, 2)) - Number(start.slice(0, 2)) < 1) {
    return NextResponse.json({ error: 'End time must be at least an hour after the start time.' }, { status: 400 })
  }

  const service = adminClient()
  const { error } = await service
    .from('profiles')
    .update({ working_days: days, working_hours_start: `${start}:00`, working_hours_end: `${end}:00` })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Could not save your hours.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isDate(body?.date)) return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 })

  const service = adminClient()
  const { data: existing } = await service
    .from('blocked_dates')
    .select('id')
    .eq('roofer_id', user.id)
    .eq('blocked_date', body.date)
    .is('market_id', null)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, id: existing.id })

  // market_id stays null: getNextAvailableSlot matches `market_id.is.null` for
  // every roofer, so a null row blocks the date no matter what market a
  // homeowner was once assigned to.
  const { data, error } = await service
    .from('blocked_dates')
    .insert({ roofer_id: user.id, blocked_date: body.date, market_id: null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Could not block that date.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const service = adminClient()
  const { error } = await service.from('blocked_dates').delete().eq('id', id).eq('roofer_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not unblock that date.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
