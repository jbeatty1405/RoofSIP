import { createServiceClient } from '@/app/_lib/supabase/server'
import { getAlertsForZip } from '@/app/_lib/noaa'
import { getTwilioClient, buildWeatherSms, buildIntroSms } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { isQuietHours } from '@/app/_lib/schedule'
import { getMarketForZip, getNextAvailableSlot } from '@/app/_lib/markets'
import { buildNoTimeWeatherSms } from '@/app/_lib/twilio'
import { NextRequest, NextResponse } from 'next/server'

function formatSlot(slot: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const timeStr = slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (slot.toDateString() === tomorrow.toDateString()) return `tomorrow at ${timeStr}`
  const day = slot.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} at ${timeStr}`
}

function resolveTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? '')
}

function pickTemplate(templates: any[], stormType: string): string | null {
  if (!templates.length) return null
  const active = templates.filter(t => t.active)
  if (!active.length) return null

  const stormLower = stormType.toLowerCase()
  const specific = active.find(t =>
    t.storm_type !== 'Any storm' && stormLower.includes(t.storm_type.toLowerCase())
  )
  const fallback = active.find(t => t.storm_type === 'Any storm')
  const template = specific ?? fallback ?? active[0]
  return template?.body ?? null
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isQuietHours()) return NextResponse.json({ skipped: true, reason: 'quiet hours' })

  const supabase = await createServiceClient()
  const twilio = getTwilioClient()

  // Send intro texts to homeowners added during quiet hours who haven't been texted yet
  const { data: uncontacted } = await supabase
    .from('homeowners')
    .select('*, profiles(pm_name, company_name)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', false)

  if (uncontacted?.length) {
    const { data: existingLogs } = await supabase
      .from('sms_logs')
      .select('homeowner_id')
      .in('homeowner_id', uncontacted.map((h: any) => h.id))
      .eq('direction', 'outbound')

    const alreadySentIds = new Set(existingLogs?.map((l: any) => l.homeowner_id))

    for (const h of uncontacted as any[]) {
      if (alreadySentIds.has(h.id)) continue
      const profile = h.profiles
      if (!profile) continue
      const firstName = h.name.split(' ')[0]
      const pmName = profile.pm_name ?? 'Your contractor'
      const company = profile.company_name ? ` from ${profile.company_name}` : ''
      const msg = buildIntroSms(pmName, h.name, profile.company_name ?? undefined)
      try {
        await twilio.messages.create({ body: msg, from: process.env.TWILIO_PHONE_NUMBER!, to: h.phone })
        await supabase.from('sms_logs').insert({
          roofer_id: h.roofer_id,
          homeowner_id: h.id,
          message: msg,
          direction: 'outbound',
          status: 'sent',
        })
      } catch (err) {
        console.error(`Deferred opt-in SMS failed to ${h.phone}:`, err)
      }
    }
  }

  // Follow-up texts: homeowners who got a storm alert 48-96h ago with no reply
  const followUpStart = new Date(Date.now() - 96 * 3600 * 1000).toISOString()
  const followUpEnd = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data: optedInHomeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, roofer_id, profiles(subscription_status)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)

  if ((optedInHomeowners ?? []).length > 0) {
    const optedInIds = (optedInHomeowners ?? []).map((h: any) => h.id)

    // Bulk-fetch alert logs in the follow-up window (1 query instead of N)
    const { data: windowAlertLogs } = await supabase
      .from('sms_logs')
      .select('homeowner_id, sent_at')
      .in('homeowner_id', optedInIds)
      .eq('direction', 'outbound')
      .gte('sent_at', followUpStart)
      .lte('sent_at', followUpEnd)

    // Map homeowner_id → earliest alert time in window
    const alertTimeByHomeowner = new Map<string, string>()
    for (const log of windowAlertLogs ?? []) {
      if (!alertTimeByHomeowner.has(log.homeowner_id)) {
        alertTimeByHomeowner.set(log.homeowner_id, log.sent_at)
      }
    }

    if (alertTimeByHomeowner.size > 0) {
      const relevantIds = [...alertTimeByHomeowner.keys()]
      const minAlertTime = [...alertTimeByHomeowner.values()].sort()[0]

      // Bulk-fetch all post-alert logs for relevant homeowners (2 queries instead of 2N)
      const { data: postAlertLogs } = await supabase
        .from('sms_logs')
        .select('homeowner_id, direction, sent_at')
        .in('homeowner_id', relevantIds)
        .gt('sent_at', minAlertTime)

      const inboundByHomeowner = new Map<string, string[]>()
      const outboundByHomeowner = new Map<string, string[]>()
      for (const log of postAlertLogs ?? []) {
        if (log.direction === 'inbound') {
          const arr = inboundByHomeowner.get(log.homeowner_id) ?? []
          arr.push(log.sent_at)
          inboundByHomeowner.set(log.homeowner_id, arr)
        } else {
          const arr = outboundByHomeowner.get(log.homeowner_id) ?? []
          arr.push(log.sent_at)
          outboundByHomeowner.set(log.homeowner_id, arr)
        }
      }

      for (const h of (optedInHomeowners ?? []) as any[]) {
        if (h.profiles?.subscription_status !== 'active') continue
        const alertTime = alertTimeByHomeowner.get(h.id)
        if (!alertTime) continue

        const hasReply = (inboundByHomeowner.get(h.id) ?? []).some(t => t > alertTime)
        if (hasReply) continue

        const hasFollowUp = (outboundByHomeowner.get(h.id) ?? []).some(t => t > alertTime)
        if (hasFollowUp) continue

        const firstName = h.name.split(' ')[0]
        const followUpMsg = `Hey ${firstName}, just following up on our last message about the weather near your home — still happy to get your roof checked out for free if you're interested.`

        try {
          await twilio.messages.create({ body: followUpMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: h.phone })
          await supabase.from('sms_logs').insert({
            roofer_id: h.roofer_id,
            homeowner_id: h.id,
            message: followUpMsg,
            direction: 'outbound',
            status: 'sent',
          })
        } catch (err) {
          console.error(`Follow-up SMS failed to ${h.phone}:`, err)
        }
      }
    }
  }

  const now = new Date().toISOString()
  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, company_name, sms_count_this_month, sms_cap, subscription_status, message_style)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)
    .or(`sms_paused_until.is.null,sms_paused_until.lt.${now}`)

  if (!homeowners?.length) return NextResponse.json({ sent: 0 })

  // Bulk-fetch today's sent logs (1 query instead of N)
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayLogs } = await supabase
    .from('sms_logs')
    .select('homeowner_id')
    .in('homeowner_id', homeowners.map((h: any) => h.id))
    .eq('direction', 'outbound')
    .gte('sent_at', `${today}T00:00:00Z`)
  const sentTodaySet = new Set(todayLogs?.map((l: any) => l.homeowner_id))

  const zips = [...new Set(homeowners.map((h: any) => h.zip_code))]
  const alertsByZip: Record<string, Awaited<ReturnType<typeof getAlertsForZip>>> = {}

  await Promise.all(zips.map(async (zip) => {
    alertsByZip[zip as string] = await getAlertsForZip(zip as string)
  }))

  // Cache templates per roofer
  const templateCache: Record<string, any[]> = {}

  let totalSent = 0

  for (const homeowner of homeowners as any[]) {
    const profile = homeowner.profiles
    if (!profile || profile.subscription_status !== 'active') continue
    if (profile.sms_count_this_month >= profile.sms_cap) continue

    const alerts = alertsByZip[homeowner.zip_code] ?? []
    if (!alerts.length) continue

    if (sentTodaySet.has(homeowner.id)) continue

    // Load templates for this roofer (cached)
    if (!templateCache[profile.id]) {
      const { data: tmpl } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('roofer_id', profile.id)
        .eq('active', true)
      templateCache[profile.id] = tmpl ?? []
    }

    const alert = alerts[0]
    const firstName = homeowner.name.split(' ')[0]
    const pmName = profile.pm_name ?? 'Your inspector'

    const market = await getMarketForZip(supabase, homeowner.zip_code)

    let message: string
    let proposedSlot: Date | null = null

    if (!market) {
      // No schedule configured — inform HO, notify PM directly
      message = buildNoTimeWeatherSms(pmName, homeowner.name, profile.company_name ?? undefined)
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'hot_lead',
        message: `Storm alert sent to ${homeowner.name} at ${homeowner.address}. No schedule set — reach out to book their free inspection. Call: ${homeowner.phone}`,
      })
    } else {
      // Market configured — pick slot and bake it into the SMS
      proposedSlot = await getNextAvailableSlot(supabase, market, profile.id)
      const proposedTime = formatSlot(proposedSlot)

      if (profile.message_style) {
        try {
          message = await generateStormSms({
            firstName,
            pmName,
            companyName: profile.company_name ?? '',
            stormType: alert.type,
            zipCode: homeowner.zip_code,
            messageStyle: profile.message_style,
            proposedTime,
          })
        } catch {
          message = buildWeatherSms(pmName, homeowner.name, alert.type, proposedTime, profile.company_name ?? undefined)
        }
      } else {
        const templateBody = pickTemplate(templateCache[profile.id], alert.type)
        message = templateBody
          ? resolveTemplate(templateBody, {
              first_name: firstName,
              pm_name: pmName,
              company_name: profile.company_name ?? '',
              storm_type: alert.type.toLowerCase(),
              zip_code: homeowner.zip_code,
              proposed_time: proposedTime,
            })
          : buildWeatherSms(pmName, homeowner.name, alert.type, proposedTime, profile.company_name ?? undefined)
      }
    }

    try {
      const msg = await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: homeowner.phone,
      })

      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message,
        twilio_sid: msg.sid,
        direction: 'outbound',
        status: msg.status,
      })

      if (proposedSlot) {
        await supabase.from('pending_bookings').upsert({
          homeowner_id: homeowner.id,
          roofer_id: homeowner.roofer_id,
          proposed_slot: proposedSlot.toISOString(),
          slots: [proposedSlot.toISOString()],
          status: 'awaiting_ho_reply',
        }, { onConflict: 'homeowner_id' })
      }

      await supabase.rpc('increment_sms_count', { p_id: profile.id })

      totalSent++
    } catch (err) {
      console.error(`SMS failed to ${homeowner.phone}:`, err)
    }
  }

  return NextResponse.json({ sent: totalSent })
}
