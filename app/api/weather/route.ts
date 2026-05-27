import { createServiceClient } from '@/app/_lib/supabase/server'
import { geocodeZip, getAlertsForPoint } from '@/app/_lib/noaa'
import { getTwilioClient, buildWeatherSms, buildIntroSms, buildNoTimeWeatherSms, isMonthlySmsCapped } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { isQuietHours } from '@/app/_lib/schedule'
import { getMarketById, getNextAvailableSlot, formatSlot } from '@/app/_lib/markets'
import { NextRequest, NextResponse } from 'next/server'

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
  return (specific ?? fallback ?? active[0])?.body ?? null
}

// Geocode all ZIPs with DB cache — minimises Nominatim calls across cron runs
async function buildGeoCache(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  zips: string[]
): Promise<Record<string, { lat: string; lon: string }>> {
  const cache: Record<string, { lat: string; lon: string }> = {}
  if (!zips.length) return cache

  const { data: cached } = await supabase.from('zip_geocache').select('zip, lat, lon').in('zip', zips)
  for (const row of cached ?? []) cache[row.zip] = { lat: row.lat, lon: row.lon }

  const missing = zips.filter(z => !cache[z])
  await Promise.all(missing.map(async (zip) => {
    const point = await geocodeZip(zip)
    if (point) {
      cache[zip] = point
      await supabase.from('zip_geocache').upsert({ zip, lat: point.lat, lon: point.lon, cached_at: new Date().toISOString() })
    }
  }))

  return cache
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isQuietHours()) return NextResponse.json({ skipped: true, reason: 'quiet hours' })

  if (await isMonthlySmsCapped()) {
    console.error('[weather] Monthly SMS cap reached — all sends blocked for the rest of this month')
    return NextResponse.json({ skipped: true, reason: 'monthly_sms_cap' })
  }

  const supabase = await createServiceClient()
  const twilio = getTwilioClient()

  // Deferred intro texts: homeowners added during quiet hours, not yet texted
  const { data: uncontacted } = await supabase
    .from('homeowners')
    .select('*, profiles(pm_name, company_name, subscription_status)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', false)
    .limit(10000)

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
      if (!profile || profile.subscription_status !== 'active') continue
      const msg = buildIntroSms(profile.pm_name ?? 'Your contractor', h.name, profile.company_name ?? undefined)
      try {
        await twilio.messages.create({ body: msg, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, to: h.phone })
        await supabase.from('sms_logs').insert({
          roofer_id: h.roofer_id,
          homeowner_id: h.id,
          message: msg,
          direction: 'outbound',
          status: 'sent',
          message_type: 'intro',
        })
      } catch (err) {
        console.error(`Deferred opt-in SMS failed to ${h.phone}:`, err)
      }
    }
  }

  // Follow-up: homeowners who got a storm alert 48–96h ago with no reply
  const followUpStart = new Date(Date.now() - 96 * 3600 * 1000).toISOString()
  const followUpEnd = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data: optedInHomeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, roofer_id, profiles(subscription_status, pm_name, company_name)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)
    .limit(10000)

  if ((optedInHomeowners ?? []).length > 0) {
    const optedInIds = (optedInHomeowners ?? []).map((h: any) => h.id)

    // Filter to storm_alert messages only so intro texts don't trigger follow-ups
    const { data: windowAlertLogs } = await supabase
      .from('sms_logs')
      .select('homeowner_id, sent_at')
      .in('homeowner_id', optedInIds)
      .eq('direction', 'outbound')
      .eq('message_type', 'storm_alert')
      .gte('sent_at', followUpStart)
      .lte('sent_at', followUpEnd)

    const alertTimeByHomeowner = new Map<string, string>()
    for (const log of windowAlertLogs ?? []) {
      if (!alertTimeByHomeowner.has(log.homeowner_id)) {
        alertTimeByHomeowner.set(log.homeowner_id, log.sent_at)
      }
    }

    if (alertTimeByHomeowner.size > 0) {
      const relevantIds = [...alertTimeByHomeowner.keys()]
      const minAlertTime = [...alertTimeByHomeowner.values()].sort()[0]

      const { data: postAlertLogs } = await supabase
        .from('sms_logs')
        .select('homeowner_id, direction, sent_at')
        .in('homeowner_id', relevantIds)
        .gt('sent_at', minAlertTime)

      const inboundByHomeowner = new Map<string, string[]>()
      const outboundByHomeowner = new Map<string, string[]>()
      for (const log of postAlertLogs ?? []) {
        const arr = (log.direction === 'inbound' ? inboundByHomeowner : outboundByHomeowner).get(log.homeowner_id) ?? []
        arr.push(log.sent_at)
        ;(log.direction === 'inbound' ? inboundByHomeowner : outboundByHomeowner).set(log.homeowner_id, arr)
      }

      for (const h of (optedInHomeowners ?? []) as any[]) {
        if (h.profiles?.subscription_status !== 'active') continue
        const alertTime = alertTimeByHomeowner.get(h.id)
        if (!alertTime) continue
        if ((inboundByHomeowner.get(h.id) ?? []).some(t => t > alertTime)) continue
        if ((outboundByHomeowner.get(h.id) ?? []).some(t => t > alertTime)) continue

        await supabase.from('notifications').insert({
          roofer_id: h.roofer_id,
          homeowner_id: h.id,
          type: 'call_needed',
          message: `${h.name} got a storm alert 2 days ago and hasn't responded — give them a call. ${h.phone} · ${h.address}`,
        })
      }
    }
  }

  const now = new Date().toISOString()

  const { data: monitorOnlyHomeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, address, zip_code, roofer_id, profiles(subscription_status)')
    .eq('monitor_only', true)
    .limit(10000)

  const { data: activeHomeowners } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, company_name, sms_count_this_month, sms_cap, subscription_status, message_style)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)
    .eq('monitor_only', false)
    .or(`sms_paused_until.is.null,sms_paused_until.lt.${now}`)
    .limit(10000)

  // Geocache all unique ZIPs in one batch for both monitor-only and active homeowners
  const allZips = [...new Set([
    ...(monitorOnlyHomeowners ?? []).map((h: any) => h.zip_code),
    ...(activeHomeowners ?? []).map((h: any) => h.zip_code),
  ].filter(Boolean))] as string[]

  const geoCache = await buildGeoCache(supabase, allZips)

  const alertsByZip: Record<string, Awaited<ReturnType<typeof getAlertsForPoint>>> = {}
  await Promise.all(allZips.map(async (zip) => {
    const point = geoCache[zip]
    alertsByZip[zip] = point ? await getAlertsForPoint(point.lat, point.lon) : []
  }))

  // Monitor-only: notify PM on storm hit, never text the homeowner
  if (monitorOnlyHomeowners?.length) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: monitorNotifiedToday } = await supabase
      .from('notifications')
      .select('homeowner_id')
      .in('homeowner_id', monitorOnlyHomeowners.map((h: any) => h.id))
      .gte('created_at', `${today}T00:00:00Z`)
    const monitorNotifiedSet = new Set(monitorNotifiedToday?.map((n: any) => n.homeowner_id))

    for (const h of monitorOnlyHomeowners as any[]) {
      const profile = h.profiles
      if (!profile || profile.subscription_status !== 'active') continue
      if (monitorNotifiedSet.has(h.id)) continue
      const alerts = alertsByZip[h.zip_code] ?? []
      if (!alerts.length) continue
      await supabase.from('notifications').insert({
        roofer_id: h.roofer_id,
        homeowner_id: h.id,
        type: 'hot_lead',
        message: `Storm hit ${h.name}'s area (${h.address}). They're monitor-only — give them a call to get consent and schedule their free inspection. Call: ${h.phone}`,
      })
    }
  }

  if (!activeHomeowners?.length) return NextResponse.json({ sent: 0 })

  // Alert dedup: skip homeowners who already received this specific NOAA alert
  const { data: sentAlertLogs } = await supabase
    .from('sms_logs')
    .select('homeowner_id, noaa_alert_id')
    .in('homeowner_id', activeHomeowners.map((h: any) => h.id))
    .not('noaa_alert_id', 'is', null)
    .eq('direction', 'outbound')
  const sentAlertSet = new Set((sentAlertLogs ?? []).map((l: any) => `${l.homeowner_id}:${l.noaa_alert_id}`))

  // Fallback dedup for alerts without an ID
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayLogs } = await supabase
    .from('sms_logs')
    .select('homeowner_id')
    .in('homeowner_id', activeHomeowners.map((h: any) => h.id))
    .eq('direction', 'outbound')
    .gte('sent_at', `${today}T00:00:00Z`)
  const sentTodaySet = new Set(todayLogs?.map((l: any) => l.homeowner_id))

  const templateCache: Record<string, any[]> = {}
  let totalSent = 0

  for (const homeowner of activeHomeowners as any[]) {
    const profile = homeowner.profiles
    if (!profile || profile.subscription_status !== 'active') continue
    if (profile.sms_count_this_month >= profile.sms_cap) continue

    const alerts = alertsByZip[homeowner.zip_code] ?? []
    if (!alerts.length) continue

    const alert = alerts[0]
    const alertId = alert.id || null

    const alreadySent = alertId
      ? sentAlertSet.has(`${homeowner.id}:${alertId}`)
      : sentTodaySet.has(homeowner.id)
    if (alreadySent) continue

    if (!templateCache[profile.id]) {
      const { data: tmpl } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('roofer_id', profile.id)
        .eq('active', true)
      templateCache[profile.id] = tmpl ?? []
    }

    const firstName = homeowner.name.split(' ')[0]
    const pmName = profile.pm_name ?? 'Your inspector'
    const market = await getMarketById(supabase, homeowner.market_id)

    let message: string
    let proposedSlot: Date | null = null

    if (!market || !market.auto_schedule) {
      message = buildNoTimeWeatherSms(pmName, homeowner.name, profile.company_name ?? undefined)
      const noScheduleReason = !market
        ? 'No schedule set'
        : `Auto-schedule is off for ${market.name}`
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'hot_lead',
        message: `Storm alert sent to ${homeowner.name} at ${homeowner.address}. ${noScheduleReason} — reach out to book their free inspection. Call: ${homeowner.phone}`,
      })
    } else {
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

    // Cap at 320 chars (2 SMS segments) to control costs
    if (message.length > 320) message = message.slice(0, 317) + '...'

    try {
      const msg = await twilio.messages.create({
        body: message,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
        to: homeowner.phone,
      })

      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message,
        twilio_sid: msg.sid,
        direction: 'outbound',
        status: msg.status,
        message_type: 'storm_alert',
        noaa_alert_id: alertId,
      })

      if (proposedSlot) {
        await supabase.from('pending_bookings').upsert({
          homeowner_id: homeowner.id,
          roofer_id: homeowner.roofer_id,
          proposed_slot: proposedSlot.toISOString(),
          slots: [proposedSlot.toISOString()],
          status: 'awaiting_ho_reply',
        }, { onConflict: 'homeowner_id' })
      } else if (market && !market.auto_schedule) {
        await supabase.from('pending_bookings').upsert({
          homeowner_id: homeowner.id,
          roofer_id: homeowner.roofer_id,
          status: 'awaiting_homeowner',
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
