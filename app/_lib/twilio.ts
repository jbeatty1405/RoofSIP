import twilio from 'twilio'

export function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

export function buildWeatherSms(pmName: string, homeownerName: string, eventType: string): string {
  const firstName = homeownerName.split(' ')[0]
  const templates = [
    `Hi ${firstName}, Hailey here. You signed up for storm alerts through ${pmName}'s team. We just had ${eventType.toLowerCase()} near your home and ${pmName} is scheduling free roof checks this week. Reply YES and ${pmName} will call to set a time.`,
    `Hey ${firstName}, Hailey with ${pmName}'s team. You're on our storm watch list and we just got hit with ${eventType.toLowerCase()} in your area. ${pmName} is doing free roof checks this week. Reply YES and he'll call you.`,
    `Hi ${firstName}, it's Hailey. You signed up for storm alerts through ${pmName} and we just had ${eventType.toLowerCase()} near your home. ${pmName} is scheduling free inspections this week. Reply YES and he'll reach out.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildBookingConfirmationSms(pmName: string, homeownerName: string, dateStr: string): string {
  const firstName = homeownerName.split(' ')[0]
  return `You're all set, ${firstName}! ${pmName} will stop by on ${dateStr} for your free roof inspection. See you then. Reply STOP to cancel.`
}
