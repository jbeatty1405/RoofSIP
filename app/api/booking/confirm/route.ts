import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient, buildBookingConfirmationSms } from '@/app/_lib/twilio'
import { addCalendarEvent } from '@/app/_lib/google'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pendingId = searchParams.get('id')

  if (!pendingId) return new NextResponse('Missing id', { status: 400 })

  const supabase = await createServiceClient()

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('*, homeowners(*, profiles(pm_name, google_access_token, google_refresh_token, google_calendar_id))')
    .eq('id', pendingId)
    .eq('status', 'awaiting_pm_confirmation')
    .maybeSingle()

  if (!pending) {
    return new NextResponse('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;max-width:400px;margin:auto"><h2>Already confirmed</h2><p>This inspection has already been booked.</p></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const homeowner = pending.homeowners
  const profile = homeowner.profiles
  const confirmedTime = new Date(pending.proposed_slot)

  const dateStr = confirmedTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  let googleEventId: string | undefined
  if (profile?.google_access_token && profile?.google_calendar_id) {
    try {
      googleEventId = await addCalendarEvent({
        accessToken: profile.google_access_token,
        refreshToken: profile.google_refresh_token,
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
  await twilio.messages.create({
    body: confirmationMsg,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: homeowner.phone,
  })
  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: confirmationMsg,
    direction: 'outbound',
    status: 'sent',
  })

  return new NextResponse(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;max-width:400px;margin:auto;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">✅</div>
    <h2 style="color:#111">Inspection confirmed!</h2>
    <p style="color:#555">${homeowner.name} has been texted their confirmation for <strong>${dateStr}</strong>.</p>
  </body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
