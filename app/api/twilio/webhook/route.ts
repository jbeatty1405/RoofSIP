import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { sendPmConfirmationEmail, sendPmTimeCheckEmail, sendPmCallEmail } from '@/app/_lib/email'
import { handleHoReply } from '@/app/_lib/ai-sms'
import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const payload = Object.fromEntries(params.entries())

  const twilioSignature = request.headers.get('x-twilio-signature') ?? ''
  const { host, protocol } = new URL(request.url)
  const url = `${protocol}//${host}/api/twilio/webhook`
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

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, pm_phone, pm_email, message_style)')
    .eq('phone', fromPhone)
    .limit(1)
    .maybeSingle()

  if (!homeowner) return new NextResponse('', { status: 200 })

  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: payload.Body,
    twilio_sid: payload.MessageSid,
    direction: 'inbound',
    status: 'received',
  })

  // Pre-opt-in: handle consent flow with simple keywords
  if (!homeowner.sms_confirmed) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    const isOptOut = ['stop', 'no', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)

    let reply: string
    if (isOptIn) {
      await supabase.from('homeowners').update({ sms_confirmed: true }).eq('id', homeowner.id)
      reply = `You're in! I'll keep an eye on things and reach out if we detect any major weather near your house. Talk soon!`
    } else if (isOptOut) {
      await supabase.from('homeowners').update({ tcpa_consent: false }).eq('id', homeowner.id)
      reply = `Got it! We won't reach out again. Take care.`
    } else {
      const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
      reply = `Hi! I'm Hailey, ${pmFirst}'s scheduling assistant. We set up storm alerts for your home — just reply to join, or text STOP to opt out.`
    }

    await twilio.messages.create({ body: reply, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: reply, direction: 'outbound', status: 'sent' })
    return new NextResponse('', { status: 200 })
  }

  // STOP always wins — TCPA compliance
  if (['stop', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)) {
    await supabase.from('homeowners').update({ tcpa_consent: false }).eq('id', homeowner.id)
    return new NextResponse('', { status: 200 })
  }

  const profile = homeowner.profiles
  const pmName = profile?.pm_name ?? 'your inspector'
  const pmFirst = pmName.split(' ')[0]
  const pmPhone = profile?.pm_phone
  const hoFirst = homeowner.name.split(' ')[0]

  // Get last outbound message for AI context
  const { data: lastOutbound } = await supabase
    .from('sms_logs')
    .select('message')
    .eq('homeowner_id', homeowner.id)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastHaileyMessage = lastOutbound?.message ?? `I reached out about storm activity near your home.`

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, proposed_slot, status')
    .eq('homeowner_id', homeowner.id)
    .maybeSingle()

  const { response: aiResponse, intent } = await handleHoReply({
    hoMessage: messageBody,
    lastHaileyMessage,
    proposedSlot: pending?.proposed_slot ?? undefined,
    pmFirstName: pmFirst,
    hoFirstName: hoFirst,
  })

  // Send Hailey's AI-generated reply
  await twilio.messages.create({ body: aiResponse, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
  await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: aiResponse, direction: 'outbound', status: 'sent' })

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
        await sendPmConfirmationEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: proposedStr, confirmUrl: '' })
      } catch (err) { console.error('PM confirmation email failed:', err) }
    }

    if (pending) await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
  }

  else if (intent.type === 'declined') {
    if (!pending) {
      const pauseUntil = new Date()
      pauseUntil.setDate(pauseUntil.getDate() + 30)
      await supabase.from('homeowners').update({ sms_paused_until: pauseUntil.toISOString() }).eq('id', homeowner.id)
    }
    // If pending exists, AI already asked for a better time — leave status as-is
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
      // Second unclear — hand off to PM
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
