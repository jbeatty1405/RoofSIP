import { createClient } from '@supabase/supabase-js'
import { getTwilioClient } from '@/app/_lib/twilio'
import { notifyRoofer } from '@/app/_lib/notify'
import { sendPmConfirmationEmail, sendPmCallEmail } from '@/app/_lib/email'
import { preClassifyIntent } from '@/app/_lib/ai-sms'
import { phoneMatchCandidates } from '@/app/_lib/phone'
import { isOptOutMessage, isOptBackInMessage } from '@/app/_lib/opt-out'
import { isQuietHoursForZip } from '@/app/_lib/schedule'
import { rooferTimezone } from '@/app/_lib/timezone'
import { APP_URL } from '@/app/_lib/url'
import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'

async function sendSms(twilio: ReturnType<typeof getTwilioClient>, to: string, body: string): Promise<{ ok: boolean; code?: number }> {
  try {
    await twilio.messages.create({ body, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, to })
    return { ok: true }
  } catch (err: any) {
    console.error(`SMS send failed to ${to}:`, err)
    return { ok: false, code: err?.code }
  }
}

// Most PMs never fill in "your email" under Settings — as of this fix, 31/33
// profiles had it blank, and 13 of those also had no push token registered,
// meaning a confirmed booking generated zero outbound notification for them
// (only an in-app row nobody was looking at). Every PM has a login email
// though, so fall back to that rather than silently skipping the send.
async function resolvePmEmail(supabase: any, profileId: string, pmEmail?: string | null): Promise<string | null> {
  if (pmEmail) return pmEmail
  try {
    const { data, error } = await supabase.auth.admin.getUserById(profileId)
    if (error) throw error
    return data?.user?.email ?? null
  } catch (err) {
    console.error('[webhook] auth email fallback lookup failed:', err)
    return null
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
  // Match a homeowner whether their phone was stored E.164 or bare 10-digit.
  const phoneCandidates = phoneMatchCandidates(fromPhone)

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
        .in('phone', phoneCandidates)
        .eq('roofer_id', profile.id)
        .maybeSingle()
      homeowner = data
    }
  }
  if (!homeowner) {
    const { data } = await supabase
      .from('homeowners')
      .select('*, profiles(id, pm_name, pm_phone, pm_email, message_style)')
      .in('phone', phoneCandidates)
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

  // ── OPT-OUT ───────────────────────────────────────────────────────────────
  // Runs before every other branch, in any state, ignoring quiet hours. It has
  // to outrank the booking logic: a homeowner who wrote "stop texting me" while
  // holding an open appointment offer used to fall through to the reschedule
  // path, which texted them again and handed the PM a call task.
  if (isOptOutMessage(messageBody)) {
    // STOP is per-person, not per-roofer: one number can sit in two PMs' books,
    // and consent is the homeowner's to withdraw everywhere at once (TCPA).
    // monitor_only is cleared too — the storm run's monitor-only list is the one
    // query that doesn't gate on consent, and it still generates PM call leads.
    const { data: affected } = await supabase
      .from('homeowners')
      .select('id, name, phone, roofer_id')
      .in('phone', phoneCandidates)

    await supabase
      .from('homeowners')
      .update({ tcpa_consent: false, monitor_only: false })
      .in('phone', phoneCandidates)

    // CTIA requires one confirmation, and it is the only message that may go to
    // a number that just opted out. If Twilio already registered the opt-out at
    // its end this fails with 21610 — which is the block working, not an error.
    const confirmation = `You're unsubscribed from RoofSIP roof storm alerts. You won't get any more texts from us. Reply START to opt back in.`
    const sent = await sendSms(twilio, fromPhone, confirmation)
    await supabase.from('sms_logs').insert({
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      message: confirmation,
      direction: 'outbound',
      status: sent.ok ? 'sent' : sent.code === 21610 ? 'blocked_opted_out' : 'failed',
      message_type: 'opt_out_confirmation',
    })

    // Tell every PM who holds this number. Without this the PM got no signal at
    // all — the homeowner went quiet and nothing in the app said why.
    const notified = new Set<string>()
    for (const h of (affected ?? []) as any[]) {
      if (notified.has(h.roofer_id)) continue
      notified.add(h.roofer_id)
      await notifyRoofer(supabase, {
        roofer_id: h.roofer_id,
        homeowner_id: h.id,
        // Not hot_lead and not call_needed — an opt-out is the one thing that is
        // explicitly NOT a task. Typing it either way would put a person who
        // just said stop at the top of the PM's call list.
        type: 'opted_out',
        pushTitle: '🚫 Opted out',
        message: `${h.name} replied STOP. They're off all texts now — no more storm alerts to ${h.phone}. Nothing to do here.`,
      })
    }
    return new NextResponse('', { status: 200 })
  }

  // START/UNSTOP — the opt-back-in our confirmation above promises. Restores
  // only someone who had a prior relationship; a bare START from a number that
  // never consented is not express consent, so it falls through to the normal
  // flow rather than silently switching texting on.
  if (isOptBackInMessage(messageBody) && !homeowner.tcpa_consent && (homeowner.tcpa_consent_at || homeowner.sms_confirmed)) {
    await supabase
      .from('homeowners')
      .update({ tcpa_consent: true, tcpa_consent_at: new Date().toISOString(), monitor_only: false })
      .eq('id', homeowner.id)
    const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
    const back = `You're back on! ${pmFirst} will reach out if we catch storm activity near your home. Msg frequency varies, msg & data rates may apply. Reply HELP for help, STOP to cancel.`
    await sendSms(twilio, fromPhone, back)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: back, direction: 'outbound', status: 'sent', message_type: 'opt_in_confirmation' })
    return new NextResponse('', { status: 200 })
  }

  // HELP keyword — CTIA-required informational response, answered in any state/quiet hours
  if (['help', 'info'].includes(messageLower)) {
    const help = `RoofSIP: free roof storm alerts & inspection scheduling. Msg frequency varies; msg & data rates may apply. Reply STOP to cancel. Help: azroofsip@gmail.com`
    await sendSms(twilio, fromPhone, help)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: help, direction: 'outbound', status: 'sent', message_type: 'reply' })
    return new NextResponse('', { status: 200 })
  }

  // Pre-opt-in: handle consent flow — always respond regardless of quiet hours
  if (!homeowner.sms_confirmed) {
    const isOptIn = ['yes', 'y', 'yep', 'yeah', 'sure', 'ok', 'okay'].includes(messageLower)
    // Every real opt-out keyword is already handled above; what's left here is a
    // plain "no" to the invite, which only reads as a refusal before opt-in.
    // (After opt-in, "no" is a homeowner declining one proposed time slot.)
    const isDecline = ['no', 'nope', 'no thanks', 'not interested'].includes(messageLower)

    if (isOptIn) {
      // A YES is the homeowner opting in themselves, so it clears monitor_only and
      // grants consent. Without this a monitor-only homeowner would get the "you're
      // all set" confirmation below but never match the storm query (which requires
      // tcpa_consent=true, monitor_only=false) — promised alerts, silence forever.
      await supabase
        .from('homeowners')
        .update({
          sms_confirmed: true,
          tcpa_consent: true,
          tcpa_consent_at: new Date().toISOString(),
          monitor_only: false,
        })
        .eq('id', homeowner.id)
      const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
      const confirmation = `You're all set! ${pmFirst} will reach out if we catch any storm activity near your home. Msg frequency varies, msg & data rates may apply. Reply HELP for help, STOP to cancel.`
      await sendSms(twilio, fromPhone, confirmation)
      await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: confirmation, direction: 'outbound', status: 'sent', message_type: 'opt_in_confirmation' })
      // Hype the PM: their homeowner just opted in and is now on watch. Pure win
      // moment (type is NOT hot_lead, so it never lands in the call list), with a
      // nudge to keep adding homes.
      await notifyRoofer(supabase, {
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'homeowner_confirmed',
        pushTitle: '✅ New roof on watch',
        message: `${homeowner.name} is confirmed and being tracked. Every home you add is another paycheck sitting there waiting on the next storm. Who else you got?`,
      })
      return new NextResponse('', { status: 200 })
    }

    let reply: string
    if (isDecline) {
      await supabase.from('homeowners').update({ tcpa_consent: false }).in('phone', phoneCandidates) // refusing the invite withdraws consent everywhere this number appears (TCPA)
      reply = `Got it! We won't reach out again. Take care.`
    } else {
      const pmFirst = (homeowner.profiles?.pm_name ?? 'your inspector').split(' ')[0]
      reply = `Hi! I'm Hailey, ${pmFirst}'s scheduling assistant. ${pmFirst} set you up for a free roof inspection if a storm comes through your area. Reply YES or STOP to opt out.`
    }

    await sendSms(twilio, fromPhone, reply)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: reply, direction: 'outbound', status: 'sent', message_type: 'reply' })
    return new NextResponse('', { status: 200 })
  }

  const profile = homeowner.profiles
  const pmName = profile?.pm_name ?? 'your inspector'
  const pmFirst = pmName.split(' ')[0]
  const hoFirst = homeowner.name.split(' ')[0]

  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, proposed_slot, status')
    .eq('homeowner_id', homeowner.id)
    .maybeSingle()

  // This homeowner's own window, from their ZIP — a reply coming in at 9:30pm
  // Eastern must get the short ack, even though it is only 6:30pm in Phoenix.
  const quiet = isQuietHoursForZip(homeowner.zip_code)

  // Inbound rate limit: cap reply volume from spam/loops.
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString()
  const { count: inboundCount } = await supabase
    .from('sms_logs')
    .select('id', { count: 'exact', head: true })
    .eq('homeowner_id', homeowner.id)
    .eq('direction', 'inbound')
    .gte('sent_at', hourAgo)
  if ((inboundCount ?? 0) >= 5) {
    const throttleMsg = `Got your message! ${pmFirst} will follow up with you soon.`
    await sendSms(twilio, fromPhone, throttleMsg)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: throttleMsg, direction: 'outbound', status: 'sent', message_type: 'reply' })
    return new NextResponse('', { status: 200 })
  }

  // During TCPA quiet hours, suppress scheduling content — send only a brief ack.
  // DB actions below still apply silently.
  async function replyHo(fullMsg: string, type: string = 'reply') {
    const msg = quiet ? `Got your message! ${pmFirst} will follow up with you during business hours.` : fullMsg
    await sendSms(twilio, fromPhone, msg)
    await supabase.from('sms_logs').insert({ roofer_id: homeowner.roofer_id, homeowner_id: homeowner.id, message: msg, direction: 'outbound', status: 'sent', message_type: type })
  }

  // Must resolve the same way the offer did in the weather route, or the
  // confirmation names a different hour than the text the homeowner said yes to.
  const slotTz = rooferTimezone(profile, homeowner.zip_code)
  const proposedStr = pending?.proposed_slot
    ? new Date(pending.proposed_slot).toLocaleDateString('en-US', { timeZone: slotTz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'a time'

  // Only an OPEN offer (a slot we are actively holding for this HO) can be acted on.
  // Already confirmed/declined/handed-off bookings are left untouched, so a stray
  // "thanks!" can never un-confirm a slot or re-trigger notifications.
  if (!pending || pending.status !== 'awaiting_ho_reply') {
    await replyHo(`Got it, ${hoFirst}! ${pmFirst} will follow up with you.`)
    return new NextResponse('', { status: 200 })
  }

  const intent = preClassifyIntent(messageBody)

  // CLEAN YES → confirm the slot we already hold for them. That slot was uniquely
  // reserved at send time, so confirming it can never double-book another homeowner.
  if (intent?.type === 'confirmed') {
    await supabase.from('pending_bookings').update({ status: 'confirmed' }).eq('id', pending.id)
    await notifyRoofer(supabase, {
      roofer_id: homeowner.roofer_id,
      homeowner_id: homeowner.id,
      // A won appointment is not a lead to call. Typing it 'hot_lead' (the
      // default) put it in the "homeowners to call" list and inflated that count.
      type: 'booking_confirmed',
      pushTitle: '📅 Inspection booked',
      message: `${homeowner.name} confirmed ${proposedStr} at ${homeowner.address}. Call them at ${homeowner.phone}.`,
    })
    const confirmEmailTo = await resolvePmEmail(supabase, profile?.id, profile?.pm_email)
    if (confirmEmailTo) {
      try {
        await sendPmConfirmationEmail({ to: confirmEmailTo, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, proposedTime: proposedStr, confirmUrl: `${APP_URL}/homeowners/${homeowner.id}`, startISO: pending.proposed_slot ?? undefined, bookingId: pending.id })
      } catch (err) { console.error('PM confirmation email failed:', err) }
    } else {
      console.error(`[webhook] booking_confirmed for roofer ${homeowner.roofer_id} has no email to notify (no pm_email, no auth email)`)
    }
    await replyHo(`Perfect, you're all set for ${proposedStr}! ${pmFirst} will see you then.`)
    return new NextResponse('', { status: 200 })
  }

  // EXPLICIT NO → decline + pause 30 days. Frees the slot; no call task (they said no).
  if (intent?.type === 'declined') {
    const pauseUntil = new Date()
    pauseUntil.setDate(pauseUntil.getDate() + 30)
    await supabase.from('homeowners').update({ sms_paused_until: pauseUntil.toISOString() }).eq('id', homeowner.id)
    await supabase.from('pending_bookings').update({ status: 'declined' }).eq('id', pending.id)
    await replyHo(`No problem, ${hoFirst} — take care! Reach out anytime if you change your mind.`)
    return new NextResponse('', { status: 200 })
  }

  // ANYTHING ELSE (can't make that time / a different time / a vague window / unclear):
  // we never parse a time from the homeowner. Free the held slot and generate a direct
  // PM call — this is what removes every double-booking path.
  await supabase.from('pending_bookings').update({ status: 'pm_calling' }).eq('id', pending.id)
  await notifyRoofer(supabase, {
    roofer_id: homeowner.roofer_id,
    homeowner_id: homeowner.id,
    type: 'call_needed',
    pushTitle: '📞 Call to reschedule',
    message: `${homeowner.name} couldn't confirm ${proposedStr} — give them a call to lock in a time. ${homeowner.phone} · ${homeowner.address}`,
  })
  const callEmailTo = await resolvePmEmail(supabase, profile?.id, profile?.pm_email)
  if (callEmailTo) {
    try {
      await sendPmCallEmail({ to: callEmailTo, pmName, homeownerName: homeowner.name, homeownerPhone: homeowner.phone, homeownerAddress: homeowner.address, availability: 'needs a quick call to pick a time' })
    } catch (err) { console.error('PM call email failed:', err) }
  } else {
    console.error(`[webhook] call_needed for roofer ${homeowner.roofer_id} has no email to notify (no pm_email, no auth email)`)
  }
  await replyHo(`Thanks ${hoFirst}! ${pmFirst} will give you a quick call to find a time that works.`)
  return new NextResponse('', { status: 200 })
}
