import { createClient } from '@supabase/supabase-js'
import { getTwilioClient } from '@/app/_lib/twilio'
import { sendPmConfirmationEmail, sendPmTimeCheckEmail, sendPmCallEmail } from '@/app/_lib/email'
import { handleHoReply, preClassifyIntent, parseHoTimeReply, HoReplyIntent } from '@/app/_lib/ai-sms'
import { isQuietHours } from '@/app/_lib/schedule'
import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'

async function sendSms(twilio: ReturnType<typeof getTwilioClient>, to: string, body: string) {
  try {
    await twilio.messages.create({ body, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, to })
  } catch (err) {
    console.error(`SMS send failed to ${to}:`, err)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const payload = Object.fromEntries(params.entries())

  const twilioSignature = request.headers.get('x-twilio-signature') ?? ''
  const host = request.headers.get('x-forwarded-host') || new URL(request.url).host
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const url = `${proto}://${host}/api/twilio/webhook`
  const isValid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    twilioSignature,
    url,
    payload
  )

  if (!isValid) return new NextResponse('Forbidden', { status: 403 })

  const fromPhone = payload.From
  const toPhone = payload.To
  const messageBody = (payload.Body ?? '').trim()
  const messageLower = messageBody.toLowerCase()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, '')
  )
  const twilio = getTwilioClient()

  // Scope homeowner lookup by contractor when the To number identifies one.
  // Falls back to unscoped first-match when all contractors share the same number.
  let homeowner: any = null
  if (toPhone) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('twilio_number', toPhone)
      .maybeSingle()
    if (profile) {
      const { data } = await supabase
        .from('homeowners')
        .select('*, profiles(id, pm_name, pm_phone, pm_email, message_style)')
        .eq('phone', fromPhone)
        .eq('roofer_id', profile.id)
        .maybeSingle()
      homeowner = data
    }
  }
  if (!homeowner) {
    const { data } = await supabase
      .from('homeowners')
      .select('*, profiles(id, pm_name, pm_phone, pm_email, message_style)')
      .eq('phone', fromPhone)
      .limit(1)
      .maybeSingle()
    homeowner = data
  }

  if (!homeowner) return new NextResponse('', { status: 200 })

  // Dedup: upsert so Twilio retries are silently dropped at the DB level
  const { data: inboundLog } = await supabase
    .from('sms_logs')
    .upsert(
      { roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: payload.Body, twilio_sid: payload.MessageSid, direction: 'inbound', status: 'received' },
      { onConflict: 'twilio_sid,direction', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()
  if (!inboundLog) return new NextResponse('', { status: 200 })

  // Pre-opt-in: handle consent flow — always respond regardless of quiet hours
  if (!homeowner.sms_confirmed) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    const isOptOut = ['stop', 'no', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)

    if (isOptIn) {
      await supabase.from('homeowners').update({ sms_confirmed: true }).eq('id', homeowner.id)
      const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
      const confirmation = `You're all set! ${pmFirst} will reach out if we catch any storm activity near your home.`
      await sendSms(twilio, fromPhone, confirmation, toPhone)
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: confirmation, direction: 'outbound', status: 'sent', message_type: 'opt_in_confirmation' })
      return new NextResponse('', { status: 200 })
    }

    let reply: string
    if (isOptOut) {
      await supabase.from('homeowners').update({ tcpa_consent: false }).eq('id', homeowner.id)
      reply = `Got it! We won't reach out again. Take care.`
    } else {
      const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
      reply = `Hi! I'm Hailey, ${pmFirst}'s scheduling assistant. ${pmFirst} set you up for a free roof inspection if anything hits near your home. Reply YES or STOP to opt out.`
    }

    await sendSms(twilio, fromPhone, reply, toPhone)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: reply, direction: 'outbound', status: 'sent', message_type: 'reply' })
    return new NextResponse('', { status: 200 })
  }

  // STOP always wins — TCPA compliance, process regardless of quiet hours
  if (['stop', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)) {
    await supabase.from('homeowners').update({ tcpa_consent: false }).eq('id', homeowner.id)
    return new NextResponse('', { status: 200 })
  }

  const profile = homeowner.profiles
  const pmName = profile?.pm_name ?? 'your inspector'
  const pmFirst = pmName.split(' ')[0]
  const pmPhone = profile?.pm_phone
  const hoFirst = homeowner.name.split(' ')[0]

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, proposed_slot, status')
    .eq('homeowner_id', homeowner.id)
    .maybeSingle()

  // TCPA quiet hours: acknowledge receipt but don't send AI scheduling content
  if (isQuietHours()) {
    const ack = `Got your message! ${pmFirst} will follow up with you during business hours.`
    await sendSms(twilio, fromPhone, ack, toPhone)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: ack, direction: 'outbound', status: 'sent', message_type: 'reply' })

    // Act on unambiguous intent silently — no reply to HO to stay TCPA-compliant
    const quickIntent = preClassifyIntent(messageBody)
    if (quickIntent?.type === 'confirmed' && pending) {
      await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
      await supabase.from('notifications').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, type: 'hot_lead', message: `${homeowner.name} confirmed after hours — follow up to lock in a time. ${homeowner.phone} · ${homeowner.address}` })
      if (profile?.pm_email) {
        try {
          const proposedStr = pending?.proposed_slot
            ? new Date(pending.proposed_slot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : 'a time TBD'
          await sendPmConfirmationEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: proposedStr, confirmUrl: `${process.env.NEXTAUTH_URL}/homeowners/${homeowner.id}` })
        } catch (err) { console.error('PM confirmation email (quiet hours) failed:', err) }
      }
    } else if (quickIntent?.type === 'declined') {
      const pauseUntil = new Date()
      pauseUntil.setDate(pauseUntil.getDate() + 30)
      await supabase.from('homeowners').update({ sms_paused_until: pauseUntil.toISOString() }).eq('id', homeowner.id)
      if (pending) await supabase.from('pending_bookings').update({ status: 'declined' }).eq('id', pending.id)
    } else {
      // Try to parse a specific time — add to PM's schedule without texting HO
      const parsedTime = await parseHoTimeReply(messageBody)
      if (parsedTime && pending) {
        const timeStr = parsedTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        await supabase.from('pending_bookings').update({ status: 'pm_reviewing', proposed_slot: parsedTime.toISOString() }).eq('id', pending.id)
        await supabase.from('notifications').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, type: 'call_needed', message: `${homeowner.name} requested ${timeStr} after hours — confirm with them. ${homeowner.phone} · ${homeowner.address}` })
        if (profile?.pm_email) {
          try {
            await sendPmTimeCheckEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: timeStr })
          } catch (err) { console.error('PM time-check email (quiet hours) failed:', err) }
        }
      }
    }

    return new NextResponse('', { status: 200 })
  }

  // Get last outbound message for AI context + last storm alert time for reply-count limit
  const [lastOutboundRes, lastAlertRes] = await Promise.all([
    supabase.from('sms_logs').select('message').eq('homeowner_id', homeowner.id).eq('direction', 'outbound').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sms_logs').select('sent_at').eq('homeowner_id', homeowner.id).eq('direction', 'outbound').eq('message_type', 'storm_alert').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const lastHaileyMessage = lastOutboundRes.data?.message ?? `I reached out about storm activity near your home.`
  const lastAlertTime = lastAlertRes.data?.sent_at

  // Cap at 2 Hailey replies per storm conversation — hand off to PM after that
  if (lastAlertTime) {
    const { count: replyCount } = await supabase
      .from('sms_logs')
      .select('id', { count: 'exact', head: true })
      .eq('homeowner_id', homeowner.id)
      .eq('direction', 'outbound')
      .eq('message_type', 'reply')
      .gt('sent_at', lastAlertTime)

    if ((replyCount ?? 0) >= 2) {
      const { data: existingHandoff } = await supabase
        .from('sms_logs')
        .select('id')
        .eq('homeowner_id', homeowner.id)
        .eq('message_type', 'handoff')
        .gt('sent_at', lastAlertTime)
        .maybeSingle()
      if (existingHandoff) return new NextResponse('', { status: 200 })

      const handoff = `${hoFirst}, sounds like this might be easier over the phone! ${pmFirst} will give you a call to get a time locked in.`
      await sendSms(twilio, fromPhone, handoff, toPhone)
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: handoff, direction: 'outbound', status: 'sent', message_type: 'handoff' })
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'call_needed',
        message: `${homeowner.name} couldn't schedule over text — give them a call. ${homeowner.phone} · ${homeowner.address}`,
      })
      if (profile?.pm_email) {
        try {
          await sendPmCallEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability: 'flexible — needs a call to confirm' })
        } catch (err) { console.error('PM call email failed:', err) }
      }
      return new NextResponse('', { status: 200 })
    }
  }

  // Claude with 7s timeout — Twilio webhook times out at 10s
  let aiResult: { response: string; intent: HoReplyIntent }
  try {
    aiResult = await Promise.race([
      handleHoReply({
        hoMessage: messageBody,
        lastHaileyMessage,
        proposedSlot: pending?.proposed_slot ?? undefined,
        pmFirstName: pmFirst,
        hoFirstName: hoFirst,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
    ])
  } catch {
    const fallback = `Got your message! ${pmFirst} will follow up with you shortly.`
    await sendSms(twilio, fromPhone, fallback, toPhone)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: fallback, direction: 'outbound', status: 'sent', message_type: 'reply' })
    return new NextResponse('', { status: 200 })
  }

  const { response: aiResponse, intent } = aiResult

  // Cap at 320 chars (2 SMS segments) to control costs
  const safeResponse = aiResponse.length > 320 ? aiResponse.slice(0, 317) + '...' : aiResponse

  await sendSms(twilio, fromPhone, safeResponse, toPhone)
  await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: safeResponse, direction: 'outbound', status: 'sent', message_type: 'reply' })

  // Act on intent
  if (intent.type === 'confirmed') {
    const proposedStr = pending?.proposed_slot
      ? new Date(pending.proposed_slot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'a time'

    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'hot_lead',
      message: `${homeowner.name} confirmed ${proposedStr} at ${homeowner.address}. Call them at ${homeowner.phone}.`,
    })

    if (profile?.pm_email) {
      try {
        const confirmUrl = `${process.env.NEXTAUTH_URL}/homeowners/${homeowner.id}`
        await sendPmConfirmationEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: proposedStr, confirmUrl })
      } catch (err) { console.error('PM confirmation email failed:', err) }
    }

    if (pending) await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
  }

  else if (intent.type === 'declined') {
    const pauseUntil = new Date()
    pauseUntil.setDate(pauseUntil.getDate() + 30)
    await supabase.from('homeowners').update({ sms_paused_until: pauseUntil.toISOString() }).eq('id', homeowner.id)
    if (pending) {
      await supabase.from('pending_bookings').update({ status: 'declined' }).eq('id', pending.id)
    }
  }

  else if (intent.type === 'gave_time') {
    const timeStr = intent.parsedTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'call_needed',
      message: `${homeowner.name} requested ${timeStr} — call to confirm. ${homeowner.phone} · ${homeowner.address}`,
    })

    if (profile?.pm_email) {
      try {
        await sendPmTimeCheckEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: timeStr })
      } catch (err) { console.error('PM time-check email failed:', err) }
    }

    if (pending) {
      await supabase.from('pending_bookings').update({ status: 'pm_reviewing', proposed_slot: intent.parsedTime.toISOString() }).eq('id', pending.id)
    }
  }

  else if (intent.type === 'gave_availability') {
    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'call_needed',
      message: `${homeowner.name} is available ${intent.availability} — call to lock in a time. ${homeowner.phone} · ${homeowner.address}`,
    })

    if (profile?.pm_email) {
      try {
        await sendPmCallEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability: intent.availability })
      } catch (err) { console.error('PM call email failed:', err) }
    }

    if (pending) await supabase.from('pending_bookings').update({ status: 'pm_calling' }).eq('id', pending.id)
  }

  else if (intent.type === 'unclear') {
    const alreadyTried = pending?.status === 'awaiting_ho_clarification'
      || pending?.status === 'awaiting_ho_time'

    if (alreadyTried) {
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'call_needed',
        message: `${homeowner.name} couldn't confirm over text — give them a call. ${homeowner.phone} · ${homeowner.address}`,
      })

      if (profile?.pm_email) {
        try {
          await sendPmCallEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability: 'flexible — needs a call to confirm' })
        } catch (err) { console.error('PM call email failed:', err) }
      }

      if (pending) await supabase.from('pending_bookings').update({ status: 'pm_calling' }).eq('id', pending.id)
    } else if (pending) {
      await supabase.from('pending_bookings').update({ status: 'awaiting_ho_clarification' }).eq('id', pending.id)
    }
  }

  return new NextResponse('', { status: 200 })
}
