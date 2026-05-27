import twilio from 'twilio'
import { createServiceClient } from '@/app/_lib/supabase/server'

export function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

// Hard cap: 4,000 outbound SMS/month ≈ $31.60 variable + ~$3 fixed = ~$35 total
// Keeps worst-case runaway well under $50/month.
const MONTHLY_SMS_CAP = 4000

export async function isMonthlySmsCapped(): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('sms_logs')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('sent_at', start.toISOString())
    return (count ?? 0) >= MONTHLY_SMS_CAP
  } catch {
    return false // fail open so a DB hiccup doesn't silently kill all SMS
  }
}

export function cleanCompanyName(raw: string): string {
  let name = raw
    .replace(/\b(LLC|L\.L\.C\.?|PLLC|Inc\.?|Corp\.?|Ltd\.?|Co\.?|PLC)\b\.?/gi, '')
    .replace(/\s*(?:and|&)\s+(?:restoration|construction|remodeling|renovation|services|service|sons|company|associates|partners|group|repair|repairs)\b.*/gi, '')
    .replace(/\s+of\s+\w+$/gi, '')
    .replace(/\s+(?:arizona|texas|california|florida|nevada|colorado|utah|georgia|ohio|michigan|illinois|washington|oregon|minnesota|wisconsin)\b$/gi, '')
    .replace(/[,\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = name.split(' ')
  if (words.length > 3) {
    const roofIdx = words.findIndex(w => /roofing?/i.test(w))
    name = roofIdx > -1 && roofIdx <= 2
      ? words.slice(0, roofIdx + 1).join(' ')
      : words.slice(0, 2).join(' ')
  }

  return name || raw.trim()
}

function haileyIntroAndAppointment(pmName: string, companyName: string | undefined, proposedTime: string) {
  const pmFirst = pmName.split(' ')[0]
  if (companyName) {
    const cleaned = cleanCompanyName(companyName)
    const hasRoofing = /roof/i.test(cleaned)
    return {
      intro: `Hailey from ${cleaned}`,
      appointment: hasRoofing
        ? `${pmFirst}'s first available is ${proposedTime}`
        : `${pmFirst}'s first available roof inspection is ${proposedTime}`,
    }
  }
  return {
    intro: `Hailey from ${pmFirst}'s roofing team`,
    appointment: `${pmFirst}'s first available roof inspection is ${proposedTime}`,
  }
}

export function buildWeatherSms(pmName: string, homeownerName: string, eventType: string, proposedTime: string, companyName?: string): string {
  const firstName = homeownerName.split(' ')[0]
  const { intro, appointment } = haileyIntroAndAppointment(pmName, companyName, proposedTime)
  const templates = [
    `Hey ${firstName}, ${intro} here. We caught some weather near your home — ${appointment}. Does that work for you?`,
    `Hey ${firstName}, ${intro} here. There's been some weather near your area. ${appointment} — does that work?`,
    `Hey ${firstName}, ${intro} here. Looks like there was some weather near your home. ${appointment}. Does that work for you?`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildNoTimeWeatherSms(pmName: string, homeownerName: string, companyName?: string): string {
  const firstName = homeownerName.split(' ')[0]
  const pmFirst = pmName.split(' ')[0]
  const cleaned = companyName ? cleanCompanyName(companyName) : ''
  const intro = cleaned ? `Hailey from ${cleaned}` : `Hailey from ${pmFirst}'s roofing team`
  return `Hey ${firstName}, ${intro} here. We caught some weather near your home — ${pmFirst} will be in touch shortly to get your roof checked out.`
}

export function buildBookingConfirmationSms(pmName: string, homeownerName: string, dateStr: string): string {
  const firstName = homeownerName.split(' ')[0]
  return `You're all set, ${firstName}! ${pmName} will stop by on ${dateStr} for your free roof inspection. See you then. Reply STOP to cancel.`
}

export function buildIntroSms(pmName: string, homeownerName: string, companyName?: string): string {
  const firstName = homeownerName.split(' ')[0]
  const pmFirst = pmName.split(' ')[0]
  const cleaned = companyName ? cleanCompanyName(companyName) : ''
  const from = cleaned ? `Hailey from ${cleaned}` : `Hailey from ${pmFirst}'s roofing team`
  return `Hey ${firstName}, ${from}! ${pmFirst} set you up for a free roof inspection if anything hits near your home. Reply YES or STOP to opt out.`
}
