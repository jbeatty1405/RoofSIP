import { createServiceClient } from '@/app/_lib/supabase/server'
import { geocodeZip, getAlertsForPoint, WeatherAlert } from '@/app/_lib/noaa'
import { getTwilioClient, buildWeatherSms, buildIntroSms, buildNoTimeWeatherSms, isMonthlySmsCapped } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { isQuietHours } from '@/app/_lib/schedule'
import { getMarketById, getNextAvailableSlot, formatSlot } from '@/app/_lib/markets'
import { checkRateLimit } from '@/app/_lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

function resolveTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? '')
}

// Last 10 digits, for comparing a homeowner phone against contractor phones.
function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(-10)
}

function extractHailInches(text: string): number {
  const m = text.match(/hail[^.]*?(\d+(?:\.\d+)?)\s*in(?:ch(?:es)?)?/i)
  return m ? parseFloat(m[1]) : 0
}

// ≥ 0.25" (quarter-size) hail bypasses cooldown — roof-damaging threshold
function isSevereHail(alert: WeatherAlert): boolean {
  return extractHailInches(alert.description) >= 0.25 || extractHailInches(alert.headline) >= 0.25
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

// Hard limits per cron execution — prevents a single bad run from blasting everyone
const MAX_STORM_ALERTS_PER_RUN = 50
const MAX_INTRO_SMS_PER_RUN = 50

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Master switch (defense in depth alongside the cron route). Sends stay OFF
  // until a deliberate go-live: set STORM_CRON_ENABLED=true once real homeowners
  // exist and the recipient list has been reviewed.
  if (process.env.STORM_CRON_ENABLED !== 'true') {
    return NextResponse.json({ paused: true, reason: 'STORM_CRON_ENABLED not set' })
  }

  if (isQuietHours()) return NextResponse.json({ skipped: true, reason: 'quiet hours' })

  if (await isMonthlySmsCapped()) {
    console.error('[weather] Monthly SMS cap reached — all sends blocked for the rest of this month')
    return NextResponse.json({ skipped: true, reason: 'monthly_sms_cap' })
  }

  const supabase = await createServiceClient()

  // Prevent more than 2 executions per hour even with a valid secret
  const cronAllowed = await checkRateLimit(supabase, null, 'cron_weather', 2, 3600 * 1000)
  if (!cronAllowed) return NextResponse.json({ skipped: true, reason: 'cron_rate_limited' })
  const twilio = getTwilioClient()

  // PM-phone guard: never text a number that belongs to a contractor (a PM who
  // entered their own number as a homeowner while testing). Defense in depth on
  // top of is_test filtering below.
  const { data: pmRows } = await supabase.from('profiles').select('pm_phone')
  const pmPhoneSet = new Set((pmRows ?? []).map((p: any) => normalizePhone(p.pm_phone)).filter(Boolean))

  // Deferred intro texts: homeowners added during quiet hours, not yet texted
  const { data: uncontacted } = await supabase
    .from('homeowners')
    .select('*, profiles(pm_name, company_name, subscription_status)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', false)
    .eq('is_test', false)
    .limit(10000)

  if (uncontacted?.length) {
    const { data: existingLogs } = await supabase
      .from('sms_logs')
      .select('homeowner_id')
      .in('homeowner_id', uncontacted.map((h: any) => h.id))
      .eq('direction', 'outbound')

    const alreadySentIds = new Set(existingLogs?.map((l: any) => l.homeowner_id))
    let introSent = 0

    for (const h of uncontacted as any[]) {
      if (introSent >= MAX_INTRO_SMS_PER_RUN) break
      if (alreadySentIds.has(h.id)) continue
      const profile = h.profiles
      if (!profile || profile.subscription_status !== 'active') continue
      if (pmPhoneSet.has(normalizePhone(h.phone))) continue // never text a contractor's own number
      const msg = buildIntroSms(profile.pm_name ?? 'Your contractor', h.name, profile.company_name ?? undefined)
      try {
        const sent = await twilio.messages.create({ body: msg, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, to: h.phone })
        const { error: logErr } = await supabase.from('sms_logs').insert({
          roofer_id: h.roofer_id,
          homeowner_id: h.id,
          message: msg,
          twilio_sid: sent.sid,
          direction: 'outbound',
          status: sent.status,
          message_type: 'intro',
        })
        if (logErr) console.error(`sms_logs insert failed for intro to ${h.phone}:`, logErr)
        else introSent++
      } catch (err: any) {
        console.error(`Deferred opt-in SMS failed to ${h.phone}:`, err)
        // 21211/21612/21614 = invalid/unreachable number — stop retrying
        const unrecoverable = [21211, 21612, 21614, 21408, 21610]
        if (unrecoverable.includes(err?.code)) {
          await supabase.from('homeowners').update({ sms_confirmed: true }).eq('id', h.id)
        }
      }
    }
  }

  // Follow-up: homeowners who got a storm alert 48–96h ago with no reply.
  // Collected here, inserted after the storm loop so we can skip anyone who
  // gets a fresh storm alert this run (new alert supersedes the follow-up).
  const followUpStart = new Date(Date.now() - 96 * 3600 * 1000).toISOString()
  const followUpEnd = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data: optedInHomeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, roofer_id, profiles(subscription_status, pm_name, company_name)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)
    .limit(10000)

  type FollowUp = { roofer_id: string; homeowner_id: string; name: string; phone: string }
  const pendingFollowUps: FollowUp[] = []

  if ((optedInHomeowners ?? []).length > 0) {
    const optedInIds = (optedInHomeowners ?? []).map((h: any) => h.id)

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
        pendingFollowUps.push({ roofer_id: h.roofer_id, homeowner_id: h.id, name: h.name, phone: h.phone })
      }
    }
  }

  const now = new Date().toISOString()

  const { data: monitorOnlyHomeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, address, zip_code, roofer_id, profiles(subscription_status)')
    .eq('monitor_only', true)
    .eq('is_test', false)
    .limit(10000)

  const { data: activeHomeowners } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, company_name, sms_count_this_month, sms_cap, subscription_status, message_style)')
    .eq('tcpa_consent', true)
    .eq('sms_confirmed', true)
    .eq('monitor_only', false)
    .eq('is_test', false)
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

  // Alert dedup: skip homeowners who already received this specific NOAA alert
  const activeIds = (activeHomeowners ?? []).map((h: any) => h.id)
  const { data: sentAlertLogs } = await supabase
    .from('sms_logs')
    .select('homeowner_id, noaa_alert_id')
    .in('homeowner_id', activeIds)
    .not('noaa_alert_id', 'is', null)
    .eq('direction', 'outbound')
  const sentAlertSet = new Set((sentAlertLogs ?? []).map((l: any) => `${l.homeowner_id}:${l.noaa_alert_id}`))

  // 48h cooldown — prevents multiple hits from the same lingering storm system.
  // Severe hail (≥ 0.25") bypasses this so a genuinely damaging new storm still fires.
  const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data: recentAlertLogs } = await supabase
    .from('sms_logs')
    .select('homeowner_id')
    .in('homeowner_id', activeIds)
    .eq('direction', 'outbound')
    .eq('message_type', 'storm_alert')
    .gte('sent_at', cutoff48h)
  const sentLast48hSet = new Set(recentAlertLogs?.map((l: any) => l.homeowner_id))

  // Cross-contractor dedup: same phone number across multiple roofer accounts
  const hoById = new Map((activeHomeowners as any[]).map((h: any) => [h.id, h]))
  const sentLast48hPhones = new Set(
    [...sentLast48hSet].map(id => hoById.get(id)?.phone).filter(Boolean)
  )

  const templateCache: Record<string, any[]> = {}
  const stormAlertedThisRun = new Set<string>()
  let totalSent = 0

  for (const homeowner of (activeHomeowners ?? []) as any[]) {
    if (totalSent >= MAX_STORM_ALERTS_PER_RUN) break

    const profile = homeowner.profiles
    if (!profile || profile.subscription_status !== 'active') continue
    if (pmPhoneSet.has(normalizePhone(homeowner.phone))) continue // never text a contractor's own number
    if (profile.sms_count_this_month >= profile.sms_cap) continue

    const alerts = alertsByZip[homeowner.zip_code] ?? []
    if (!alerts.length) continue

    // 48h cooldown — bypass only for severe hail (≥ 0.25") on a fresh alert
    const inCooldown = sentLast48hSet.has(homeowner.id) || sentLast48hPhones.has(homeowner.phone)
    if (inCooldown && !alerts.some(isSevereHail)) continue

    const alert = alerts[0]
    const alertId = alert.id || null

    // Also dedupe on specific NOAA alert ID (handles same alert recurring in feed)
    if (alertId && sentAlertSet.has(`${homeowner.id}:${alertId}`)) continue

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

    if (market && market.auto_schedule) {
      // Reserve a unique slot BEFORE sending. The partial unique index on
      // (roofer_id, proposed_slot) makes a racing reservation fail with 23505;
      // on conflict we recompute the next open slot and retry — so two homeowners
      // can never be offered (or booked into) the same time, even across
      // overlapping cron runs.
      for (let attempt = 0; attempt < 6 && !proposedSlot; attempt++) {
        const slot = await getNextAvailableSlot(supabase, market, profile.id)
        const { error: reserveErr } = await supabase.from('pending_bookings').upsert({
          homeowner_id: homeowner.id,
          roofer_id: homeowner.roofer_id,
          proposed_slot: slot.toISOString(),
          slots: [slot.toISOString()],
          status: 'awaiting_ho_reply',
        }, { onConflict: 'homeowner_id' })
        if (!reserveErr) { proposedSlot = slot; break }
        if (reserveErr.code !== '23505') { console.error('slot reserve failed:', reserveErr); break }
        // 23505: slot just taken by a concurrent reservation — loop picks the next one
      }
    }

    if (proposedSlot) {
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
    } else {
      // No timed offer: auto-schedule off, no market, or no open slot could be reserved.
      message = buildNoTimeWeatherSms(pmName, homeowner.name, profile.company_name ?? undefined)
      const noScheduleReason = !market
        ? 'No schedule set'
        : (!market.auto_schedule ? `Auto-schedule is off for ${market.name}` : 'No open slot available')
      await supabase.from('notifications').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        type: 'hot_lead',
        message: `Storm alert sent to ${homeowner.name} at ${homeowner.address}. ${noScheduleReason} — reach out to book their free inspection. Call: ${homeowner.phone}`,
      })
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

      // Timed offers are already reserved above. Only the no-time case needs a row here.
      if (!proposedSlot && market) {
        await supabase.from('pending_bookings').upsert({
          homeowner_id: homeowner.id,
          roofer_id: homeowner.roofer_id,
          status: 'awaiting_homeowner',
        }, { onConflict: 'homeowner_id' })
      }

      stormAlertedThisRun.add(homeowner.id)
      sentLast48hPhones.add(homeowner.phone)
      const { error: incErr } = await supabase.rpc('increment_sms_count', { p_id: profile.id })
      if (incErr) console.error('increment_sms_count failed — per-roofer SMS cap will NOT enforce:', incErr)
      totalSent++
    } catch (err) {
      console.error(`SMS failed to ${homeowner.phone}:`, err)
    }
  }

  // Process follow-ups now that we know who got a fresh storm alert this run.
  // Skip any homeowner who just received a new storm alert — it supersedes the follow-up.
  for (const fu of pendingFollowUps) {
    if (stormAlertedThisRun.has(fu.homeowner_id)) continue
    await supabase.from('notifications').insert({
      roofer_id: fu.roofer_id,
      homeowner_id: fu.homeowner_id,
      type: 'call_needed',
      message: `${fu.name} got a storm alert 2 days ago and hasn't responded — give them a call. ${fu.phone}`,
    })
    // Release the slot we were holding for them (no reply after 2 days) so it
    // returns to the available pool. Only touches still-open holds.
    await supabase.from('pending_bookings')
      .update({ status: 'expired' })
      .eq('homeowner_id', fu.homeowner_id)
      .eq('status', 'awaiting_ho_reply')
  }

  return NextResponse.json({ sent: totalSent })
}
