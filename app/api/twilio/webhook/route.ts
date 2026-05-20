import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { sendPmConfirmationEmail, sendPmTimeCheckEmail, sendPmCallEmail } from '@/app/_lib/email'
import { parseHoTimeReply, extractHoAvailability } from '@/app/_lib/ai-sms'
import { getMarketForZip, getNextAvailableSlot, formatSlot } from '@/app/_lib/markets'
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

  // Homeowner reply
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

  // Handle YES/STOP to the intro text (homeowner hasn't confirmed yet)
  if (!homeowner.sms_confirmed) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    const isOptOut = ['stop', 'no', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)

    if (isOptIn) {
      await supabase
        .from('homeowners')
        .update({ sms_confirmed: true })
        .eq('id', homeowner.id)

      const msg = `You're in! I'll keep an eye on things and reach out if we detect any major weather near your house. Talk soon!`
      await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message: msg,
        direction: 'outbound',
        status: 'sent',
      })
    } else if (isOptOut) {
      await supabase.from('homeowners').update({ tcpa_consent: false }).eq('id', homeowner.id)
      const msg = `Got it! We won't reach out again. Take care.`
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

  const profile = homeowner.profiles
  const pmName = profile?.pm_name ?? 'your inspector'
  const pmFirst = pmName.split(' ')[0]
  const pmPhone = profile?.pm_phone

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, proposed_slot, status')
    .eq('homeowner_id', homeowner.id)
    .maybeSingle()

  const isYes = messageLower === 'yes' || messageLower === 'y'
  const isNo = /^(no|nope|n|no thanks|doesn'?t work|can'?t|won'?t|not available|busy)\b/i.test(messageLower) && messageBody.length < 60

  // HO confirmed the proposed time
  if (isYes && pending?.status === 'awaiting_ho_reply') {
    const proposedStr = pending.proposed_slot
      ? new Date(pending.proposed_slot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'the proposed time'

    const confirmMsg = pmPhone
      ? `You're confirmed, ${homeowner.name.split(' ')[0]}! ${pmFirst} will reach out within the hour to finalize. Their number is ${pmPhone}.`
      : `You're confirmed, ${homeowner.name.split(' ')[0]}! ${pmFirst} will reach out within the hour to finalize.`
    await twilio.messages.create({ body: confirmMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: confirmMsg, direction: 'outbound', status: 'sent' })

    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'hot_lead',
      message: `${homeowner.name} confirmed ${proposedStr} at ${homeowner.address}. Call them at ${homeowner.phone}.`,
    })

    if (profile?.pm_email) {
      try {
        await sendPmConfirmationEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: proposedStr, confirmUrl: '' })
      } catch (err) { console.error('PM email failed:', err) }
    }

    await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
    return new NextResponse('', { status: 200 })
  }

  // HO said YES but no pending booking (replied yes to "Mike will reach out" text)
  if (isYes && !pending) {
    await supabase.from('notifications').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      type: 'hot_lead',
      message: `${homeowner.name} said YES — call them at ${homeowner.phone} (${homeowner.address}).`,
    })

    if (profile?.pm_email) {
      try {
        await sendPmCallEmail({
          to: profile.pm_email,
          pmName,
          homeownerName: homeowner.name,
          homeownerPhone: homeowner.phone,
          homeownerAddress: homeowner.address,
          availability: 'ready now — they replied YES',
        })
      } catch (err) { console.error('PM hot lead email failed:', err) }
    }

    return new NextResponse('', { status: 200 })
  }

  // HO declined with no active booking (replied no to "Mike will reach out" text) — pause for 30 days
  if (isNo && !pending) {
    const pauseUntil = new Date()
    pauseUntil.setDate(pauseUntil.getDate() + 30)
    await supabase.from('homeowners').update({ sms_paused_until: pauseUntil.toISOString() }).eq('id', homeowner.id)
    const closeMsg = `No problem at all! If anything changes down the road, we're here.`
    await twilio.messages.create({ body: closeMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: closeMsg, direction: 'outbound', status: 'sent' })
    return new NextResponse('', { status: 200 })
  }

  // HO declined proposed time — ask for their best time
  if (isNo && pending?.status === 'awaiting_ho_reply') {
    const noMsg = `No problem! When's the best time for you?`
    await twilio.messages.create({ body: noMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: noMsg, direction: 'outbound', status: 'sent' })
    await supabase.from('pending_bookings').update({ status: 'awaiting_ho_time' }).eq('id', pending.id)
    return new NextResponse('', { status: 200 })
  }

  // Ambiguous reply to storm SMS (not YES/NO, pending awaiting_ho_reply)
  // If PM has a market with open slots, re-offer next available. Otherwise PM calls.
  if (pending?.status === 'awaiting_ho_reply') {
    const market = await getMarketForZip(supabase, homeowner.zip_code)
    if (market) {
      const slot = await getNextAvailableSlot(supabase, market, homeowner.roofer_id)
      const slotStr = formatSlot(slot)
      const reofferMsg = `No worries! ${pmFirst}'s next open spot is ${slotStr} — does that work for you? Reply YES or let me know what works better.`
      await twilio.messages.create({ body: reofferMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: reofferMsg, direction: 'outbound', status: 'sent' })
      await supabase.from('pending_bookings').update({ proposed_slot: slot.toISOString() }).eq('id', pending.id)
    } else {
      const reachOutMsg = `No worries! ${pmFirst} will reach out to confirm what time works best for both your schedules.`
      await twilio.messages.create({ body: reachOutMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: reachOutMsg, direction: 'outbound', status: 'sent' })
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'call_needed',
        message: `${homeowner.name} sent an ambiguous reply — reach out to confirm a time. ${homeowner.phone} · ${homeowner.address}`,
      })
      if (profile?.pm_email) {
        try {
          await sendPmCallEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability: 'flexible — they need help picking a time' })
        } catch (err) { console.error('PM call email failed:', err) }
      }
    }
    return new NextResponse('', { status: 200 })
  }

  // HO gave their preferred time
  if (pending?.status === 'awaiting_ho_time') {
    const parsedTime = await parseHoTimeReply(messageBody)
    if (parsedTime) {
      const timeStr = parsedTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

      const checkMsg = `Got it! ${pmFirst} will reach out to confirm.`
      await twilio.messages.create({ body: checkMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: checkMsg, direction: 'outbound', status: 'sent' })

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

      await supabase.from('pending_bookings').update({ status: 'pm_reviewing', proposed_slot: parsedTime.toISOString() }).eq('id', pending.id)
    } else {
      const availability = await extractHoAvailability(messageBody)
      if (availability) {
        const callMsg = `Got it! ${pmFirst} will give you a call to lock in a time.`
        await twilio.messages.create({ body: callMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
        await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: callMsg, direction: 'outbound', status: 'sent' })

        await supabase.from('notifications').insert({
          roofer_id: homeowner.roofer_id,
          homeowner_id: homeowner.id,
          type: 'call_needed',
          message: `${homeowner.name} is available ${availability} — call to lock in a time. ${homeowner.phone} · ${homeowner.address}`,
        })

        if (profile?.pm_email) {
          try {
            await sendPmCallEmail({ to: profile.pm_email, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability })
          } catch (err) { console.error('PM call email failed:', err) }
        }

        await supabase.from('pending_bookings').update({ status: 'pm_calling' }).eq('id', pending.id)
      } else {
        const clarifyMsg = `What day and time works best for you? For example, "Thursday at 10am" or "Saturday morning."`
        await twilio.messages.create({ body: clarifyMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
        await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: clarifyMsg, direction: 'outbound', status: 'sent' })
      }
    }
    return new NextResponse('', { status: 200 })
  }

  return new NextResponse('', { status: 200 })
}
