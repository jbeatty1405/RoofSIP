import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient, buildBookingConfirmationSms } from '@/app/_lib/twilio'
import { addCalendarEvent, getAvailableSlots } from '@/app/_lib/google'
import { getMarketForZip } from '@/app/_lib/markets'
import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const payload = Object.fromEntries(params.entries())

  const twilioSignature = request.headers.get('x-twilio-signature') ?? ''
  const url = `${process.env.NEXTAUTH_URL}/api/twilio/webhook`
  const isValid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    twilioSignature,
    url,
    payload
  )

  if (!isValid) return new NextResponse('Forbidden', { status: 403 })

  const fromPhone = payload.From
  const messageBody = (payload.Body ?? '').trim().toLowerCase()

  const supabase = await createServiceClient()

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, message_style, google_access_token, google_refresh_token, google_calendar_id)')
    .eq('phone', fromPhone)
    .single()

  if (!homeowner) return new NextResponse('', { status: 200 })

  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: payload.Body,
    twilio_sid: payload.MessageSid,
    direction: 'inbound',
    status: 'received',
  })

  const profile = homeowner.profiles
  const twilio = getTwilioClient()

  // Phase 2: homeowner replied "4" — none of the times work
  if (messageBody === '4') {
    const { data: pending } = await supabase
      .from('pending_bookings')
      .select('*')
      .eq('homeowner_id', homeowner.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pending) {
      await supabase.from('pending_bookings').delete().eq('id', pending.id)

      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'manual_schedule',
        message: `Call ${homeowner.name} at ${homeowner.phone} — none of the offered inspection times worked for them.`,
      })

      const msg = `No problem! ${profile?.pm_name ?? 'Your contractor'} will give you a call to find a time that works.`
      await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message: msg,
        direction: 'outbound',
        status: 'sent',
      })
    }

    return new NextResponse('', { status: 200 })
  }

  // Phase 2: homeowner is picking a slot (1, 2, or 3)
  const pick = ['1', '2', '3'].indexOf(messageBody)
  if (pick !== -1) {
    const { data: pending } = await supabase
      .from('pending_bookings')
      .select('*')
      .eq('homeowner_id', homeowner.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pending) {
      const slots: string[] = pending.slots
      const chosen = slots[pick] ? new Date(slots[pick]) : null

      if (chosen) {
        const dateStr = chosen.toLocaleDateString('en-US', {
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
              startTime: chosen,
              durationMinutes: 60,
            })
          } catch (err) {
            console.error('Calendar event failed:', err)
          }
        }

        await supabase.from('bookings').insert({
          roofer_id: homeowner.roofer_id,
          homeowner_id: homeowner.id,
          scheduled_at: chosen.toISOString(),
          google_event_id: googleEventId,
          status: 'scheduled',
        })

        await supabase.from('pending_bookings').delete().eq('id', pending.id)

        const confirmationMsg = buildBookingConfirmationSms(profile?.pm_name ?? 'your inspector', homeowner.name, dateStr)
        await twilio.messages.create({ body: confirmationMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
        await supabase.from('sms_logs').insert({
          roofer_id: homeowner.roofer_id,
          homeowner_id: homeowner.id,
          message: confirmationMsg,
          direction: 'outbound',
          status: 'sent',
        })
      }
    }

    return new NextResponse('', { status: 200 })
  }

  // Phase 1: homeowner replied YES
  if (messageBody !== 'yes' && messageBody !== 'y') {
    return new NextResponse('', { status: 200 })
  }

  const market = await getMarketForZip(supabase, homeowner.zip_code)

  if (market && !market.auto_schedule) {
    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'manual_schedule',
      message: `Call ${homeowner.name} at ${homeowner.phone} to schedule their free roof inspection — they replied YES to the storm alert.`,
    })

    const msg = `Thanks! ${profile?.pm_name ?? 'Your contractor'} will be in touch soon to schedule your free inspection.`
    await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    await supabase.from('sms_logs').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      message: msg,
      direction: 'outbound',
      status: 'sent',
    })

    return new NextResponse('', { status: 200 })
  }

  // Get available slots from Google Calendar
  let slots: Date[] = []
  if (profile?.google_access_token && profile?.google_calendar_id) {
    try {
      slots = await getAvailableSlots({
        accessToken: profile.google_access_token,
        refreshToken: profile.google_refresh_token,
        calendarId: profile.google_calendar_id,
        workingDays: market?.working_days ?? [1, 2, 3, 4, 5],
        workingStart: market?.working_hours_start ?? '08:00',
        workingEnd: market?.working_hours_end ?? '17:00',
      })
    } catch (err) {
      console.error('Failed to get calendar slots:', err)
    }
  }

  // Fall back to generated slots if no calendar connected
  if (!slots.length) {
    slots = generateFallbackSlots(market)
  }

  // Store pending slots
  await supabase.from('pending_bookings').delete().eq('homeowner_id', homeowner.id)
  await supabase.from('pending_bookings').insert({
    homeowner_id: homeowner.id,
    roofer_id: homeowner.roofer_id,
    slots: slots.map(s => s.toISOString()),
  })

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const optionsMsg = `Awesome! Here are ${slots.length} times we have open:\n\n1. ${fmt(slots[0])}${slots[1] ? `\n2. ${fmt(slots[1])}` : ''}${slots[2] ? `\n3. ${fmt(slots[2])}` : ''}\n4. None of these work\n\nReply 1, 2, 3, or 4.`

  await twilio.messages.create({ body: optionsMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: optionsMsg,
    direction: 'outbound',
    status: 'sent',
  })

  return new NextResponse('', { status: 200 })
}

function generateFallbackSlots(market: any): Date[] {
  const workingDays: number[] = market?.working_days ?? [1, 2, 3, 4, 5]
  const [startH] = (market?.working_hours_start ?? '08:00').split(':').map(Number)

  const slots: Date[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1)
  cursor.setHours(startH, 0, 0, 0)

  while (slots.length < 3) {
    if (workingDays.includes(cursor.getDay())) {
      slots.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    } else {
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return slots
}
