import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient, buildBookingConfirmationSms } from '@/app/_lib/twilio'
import { addCalendarEvent } from '@/app/_lib/google'
import { verifyBookingToken } from '@/app/_lib/booking-token'
import { decryptToken } from '@/app/_lib/token-crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? searchParams.get('id')
  const target = new URL('/booking/confirm', request.url)
  if (token) target.searchParams.set('token', token)
  return NextResponse.redirect(target, 303)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: string } | null
  const token = body?.token
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const verified = verifyBookingToken(token)
  if (!verified) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('*, homeowners(*, profiles(pm_name, google_access_token, google_refresh_token, google_calendar_id))')
    .eq('id', verified.pendingId)
    .eq('status', 'awaiting_pm_confirmation')
    .maybeSingle()

  if (!pending) return NextResponse.json({ error: 'Already confirmed' }, { status: 409 })

  const homeowner = pending.homeowners
  const profile = homeowner.profiles
  const confirmedTime = new Date(pending.proposed_slot)

  const dateStr = confirmedTime.toLocaleDateString('en-US', {
    timeZone: 'America/Phoenix', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  let googleEventId: string | undefined
  if (profile?.google_access_token && profile?.google_calendar_id) {
    try {
      googleEventId = await addCalendarEvent({
        accessToken: decryptToken(profile.google_access_token),
        refreshToken: profile.google_refresh_token ? decryptToken(profile.google_refresh_token) : '',
        calendarId: profile.google_calendar_id,
        summary: `Roof inspection — ${homeowner.name}`,
        description: `Address: ${homeowner.address}\nPhone: ${homeowner.phone}`,
        startTime: confirmedTime,
        durationMinutes: 60,
      })
    } catch (err) {
      console.error('Calendar event failed:', err)
    }
  }

  await supabase.from('bookings').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    scheduled_at: confirmedTime.toISOString(),
    google_event_id: googleEventId,
    status: 'scheduled',
  })

  await supabase.from('pending_bookings').delete().eq('id', pending.id)

  const twilio = getTwilioClient()
  const confirmationMsg = buildBookingConfirmationSms(profile?.pm_name ?? 'your inspector', homeowner.name, dateStr)
  try {
    await twilio.messages.create({
      body: confirmationMsg,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
      to: homeowner.phone,
    })
    await supabase.from('sms_logs').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      message: confirmationMsg,
      direction: 'outbound',
      status: 'sent',
    })
  } catch (err) {
    console.error('Confirmation SMS failed:', err)
  }

  return NextResponse.json({ ok: true, dateStr })
}
