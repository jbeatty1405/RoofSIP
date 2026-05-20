import twilio from 'twilio'

export function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
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
    `Hey ${firstName}, ${intro} here. You signed up for storm alerts with ${pmName} — our system flagged storm activity near your home. ${appointment}, does that work for you? Reply YES.`,
    `Hey ${firstName}, ${intro} here. You're signed up for storm alerts with ${pmName} and our system just picked up activity near your home. ${appointment}. Does that work? Reply YES.`,
    `Hey ${firstName}, ${intro} here. Our system flagged storm activity near your home — you signed up for alerts with ${pmName}. ${appointment}. Does that work for you? Reply YES.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildNoTimeWeatherSms(pmName: string, homeownerName: string, companyName?: string): string {
  const firstName = homeownerName.split(' ')[0]
  const pmFirst = pmName.split(' ')[0]
  const cleaned = companyName ? cleanCompanyName(companyName) : ''
  const intro = cleaned ? `Hailey from ${cleaned}` : `Hailey from ${pmFirst}'s roofing team`
  return `Hey ${firstName}, ${intro} here. You signed up for storm alerts with ${pmName} — our system flagged storm activity near your home. ${pmFirst} will be reaching out shortly to schedule your free roof inspection.`
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
  return `Hey ${firstName}, ${from} here! ${pmFirst} just added you to receive free storm alerts for your roof. I'll text you if our system picks up storm activity near your home. Reply STOP anytime to opt out.`
}
