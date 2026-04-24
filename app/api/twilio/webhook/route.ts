import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient, buildBookingConfirmationSms } from '@/app/_lib/twilio'
import { addCalendarEvent } from '@/app/_lib/google'
import { getMarketForZip } from '@/app/_lib/markets'
import { parsePmTimeReply } from '@/app/_lib/ai-sms'
import { sendPmConfirmationEmail } from '@/app/_lib/email'
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
  const messageBody = (payload.Body ?? '').trim()
  const messageLower = messageBody.toLowerCase()

  const supabase = await createServiceClient()
  const twilio = getTwilioClient()

  // Check if this is a PM replying to a confirmation request
  const { data: pmProfile } = await supabase
    .from('profiles')
    .select('id, pm_name, company_name, google_access_token, google_refresh_token, google_calendar_id')
    .eq('pm_phone', fromPhone)
    .maybeSingle()

  if (pmProfile) {
    const { data: pending } = await supabase
      .from('pending_bookings')
      .select('*, homeowners(*)')
      .eq('roofer_id', pmProfile.id)
      .eq('status', 'awaiting_pm_confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pending) {
      const homeowner = pending.homeowners
      let confirmedTime: Date | null = null

      if (messageLower === 'yes' || messageLower === 'y') {
        confirmedTime = new Date(pending.proposed_slot)
      } else {
        confirmedTime = await parsePmTimeReply(messageBody, new Date(pending.proposed_slot))
      }

      if (confirmedTime) {
        const dateStr = confirmedTime.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })

        let googleEventId: string | undefined
        if (pmProfile.google_access_token && pmProfile.google_calendar_id) {
          try {
            googleEventId = await addCalendarEvent({
              accessToken: pmProfile.google_access_token,
              refreshToken: pmProfile.google_refresh_token,
              calendarId: pmProfile.google_calendar_id,
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

        const confirmationMsg = buildBookingConfirmationSms(pmProfile.pm_name ?? 'your inspector', homeowner.name, dateStr)
        await twilio.messages.create({ body: confirmationMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: homeowner.phone })
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

  // Homeowner reply
  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, pm_phone, pm_email, message_style, google_access_token, google_refresh_token, google_calendar_id)')
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

  // Handle opt-in flow (homeowner hasn't consented yet)
  if (!homeowner.tcpa_consent) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    const isOptOut = ['stop', 'no', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)

    if (isOptIn) {
      await supabase
        .from('homeowners')
        .update({ tcpa_consent: true, tcpa_consent_at: new Date().toISOString() })
        .eq('id', homeowner.id)

      const msg = `You're in! We'll text you a heads up whenever there's storm activity near your home, along with an offer for a free roof inspection. Reply STOP anytime to opt out.`
      await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message: msg,
        direction: 'outbound',
        status: 'sent',
      })
    } else if (isOptOut) {
      const msg = `Got it — we won't reach out again. Have a great day!`
      await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    }

    return new NextResponse('', { status: 200 })
  }

  // Handle STOP from consented homeowners
  if (['stop', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)) {
    await supabase
      .from('homeowners')
      .update({ tcpa_consent: false })
      .eq('id', homeowner.id)
    return new NextResponse('', { status: 200 })
  }

  if (messageLower !== 'yes' && messageLower !== 'y') {
    return new NextResponse('', { status: 200 })
  }

  const profile = homeowner.profiles

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

  // Pick a proposed slot
  const proposedSlot = generateProposedSlot(market)
  const proposedStr = proposedSlot.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  // Clear old pending and store new one
  await supabase.from('pending_bookings').delete().eq('homeowner_id', homeowner.id)
  const { data: newPending } = await supabase.from('pending_bookings').insert({
    homeowner_id: homeowner.id,
    roofer_id: homeowner.roofer_id,
    slots: [proposedSlot.toISOString()],
    proposed_slot: proposedSlot.toISOString(),
    status: 'awaiting_pm_confirmation',
  }).select().single()

  // Text homeowner
  const homeownerMsg = `Perfect! We're looking at ${proposedStr}. ${profile?.pm_name ?? 'Your contractor'} will confirm with you shortly.`
  await twilio.messages.create({ body: homeownerMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: homeownerMsg,
    direction: 'outbound',
    status: 'sent',
  })

  // Email PM
  if (profile?.pm_email && newPending) {
    const confirmUrl = `${process.env.NEXTAUTH_URL}/api/booking/confirm?id=${newPending.id}`
    try {
      await sendPmConfirmationEmail({
        to: profile.pm_email,
        pmName: profile.pm_name ?? 'there',
        homeownerName: homeowner.name,
        homeownerPhone: homeowner.phone,
        homeownerAddress: homeowner.address,
        proposedTime: proposedStr,
        confirmUrl,
      })
    } catch (err) {
      console.error('PM email failed:', err)
    }
  }

  return new NextResponse('', { status: 200 })
}

function generateProposedSlot(market: any): Date {
  const workingDays: number[] = market?.working_days ?? [1, 2, 3, 4, 5]
  const [startH] = (market?.working_hours_start ?? '09:00').split(':').map(Number)

  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(startH, 0, 0, 0)

  while (!workingDays.includes(d.getDay())) {
    d.setDate(d.getDate() + 1)
  }

  return d
}
