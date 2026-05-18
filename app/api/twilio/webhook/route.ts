import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { sendPmConfirmationEmail } from '@/app/_lib/email'
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

  // Handle opt-in flow (homeowner hasn't consented yet)
  if (!homeowner.tcpa_consent) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    const isOptOut = ['stop', 'no', 'unsubscribe', 'cancel', 'quit'].includes(messageLower)

    if (isOptIn) {
      await supabase
        .from('homeowners')
        .update({ tcpa_consent: true, tcpa_consent_at: new Date().toISOString() })
        .eq('id', homeowner.id)

      const msg = `You're in! This is Hailey. I'll keep an eye on storm activity near your home and reach out when anything hits. Reply STOP anytime to opt out.`
      await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message: msg,
        direction: 'outbound',
        status: 'sent',
      })
    } else if (isOptOut) {
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

  if (messageLower !== 'yes' && messageLower !== 'y') {
    return new NextResponse('', { status: 200 })
  }

  const profile = homeowner.profiles
  const pmName = profile?.pm_name ?? 'your inspector'
  const pmPhone = profile?.pm_phone

  // Look up proposed slot that was stored when the storm SMS was sent
  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, proposed_slot')
    .eq('homeowner_id', homeowner.id)
    .eq('status', 'awaiting_ho_reply')
    .maybeSingle()

  const proposedStr = pending?.proposed_slot
    ? new Date(pending.proposed_slot).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'the proposed time'

  // Confirm to homeowner
  const homeownerMsg = pmPhone
    ? `You're confirmed, ${homeowner.name.split(' ')[0]}! ${pmName} will reach out within the hour to finalize. Their number is ${pmPhone}.`
    : `You're confirmed, ${homeowner.name.split(' ')[0]}! ${pmName} will reach out within the hour to finalize.`
  await twilio.messages.create({ body: homeownerMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: fromPhone })
  await supabase.from('sms_logs').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    message: homeownerMsg,
    direction: 'outbound',
    status: 'sent',
  })

  // Notify PM
  await supabase.from('notifications').insert({
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    type: 'hot_lead',
    message: `${homeowner.name} confirmed ${proposedStr} at ${homeowner.address}. Call them at ${homeowner.phone}.`,
  })

  if (profile?.pm_email) {
    try {
      await sendPmConfirmationEmail({
        to: profile.pm_email,
        pmName,
        homeownerName: homeowner.name,
        homeownerPhone: homeowner.phone,
        homeownerAddress: homeowner.address,
        proposedTime: proposedStr,
        confirmUrl: '',
      })
    } catch (err) {
      console.error('PM email failed:', err)
    }
  }

  if (pending) {
    await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
  }

  return new NextResponse('', { status: 200 })
}
