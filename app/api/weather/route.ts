import { createServiceClient } from '@/app/_lib/supabase/server'
import { getAlertsForZip } from '@/app/_lib/noaa'
import { getTwilioClient } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { isQuietHours } from '@/app/_lib/schedule'
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

  // Send opt-in texts to homeowners added during quiet hours who haven't been texted yet
  const { data: uncontacted } = await supabase
    .from('homeowners')
    .select('*, profiles(pm_name, company_name)')
    .eq('tcpa_consent', false)

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
      const msg = `Hi ${firstName}! ${pmName}${company} added you to receive free storm alerts for your roof. When storm activity hits your area, we'll send a heads up and offer a free inspection. Reply YES to opt in or STOP to skip.`
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
        const followUpMsg = `Hey ${firstName}, just following up — did you see our message about storm activity near your home? A free roof inspection could catch damage early before it gets costly. Reply YES if you'd like us to take a look.`

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

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, company_name, sms_count_this_month, sms_cap, subscription_status, message_style)')
    .eq('tcpa_consent', true)

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

    let message: string
    if (profile.message_style) {
      try {
        message = await generateStormSms({
          firstName,
          pmName: profile.pm_name ?? '',
          companyName: profile.company_name ?? '',
          stormType: alert.type,
          zipCode: homeowner.zip_code,
          messageStyle: profile.message_style,
        })
      } catch {
        message = `Hi ${firstName}, this is ${profile.pm_name} from ${profile.company_name ?? 'our roofing team'}. We're seeing ${alert.type.toLowerCase()} activity near your home. Reply YES for a free roof inspection.`
      }
    } else {
      const templateBody = pickTemplate(templateCache[profile.id], alert.type)
      message = templateBody
        ? resolveTemplate(templateBody, {
            first_name: firstName,
            pm_name: profile.pm_name ?? '',
            company_name: profile.company_name ?? '',
            storm_type: alert.type.toLowerCase(),
            zip_code: homeowner.zip_code,
          })
        : `Hi ${firstName}, this is ${profile.pm_name} from ${profile.company_name ?? 'our roofing team'}. We're seeing ${alert.type.toLowerCase()} activity near your home. Reply YES for a free roof inspection.`
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

      await supabase.rpc('increment_sms_count', { p_id: profile.id })

      totalSent++
    } catch (err) {
      console.error(`SMS failed to ${homeowner.phone}:`, err)
    }
  }

  return NextResponse.json({ sent: totalSent })
}
