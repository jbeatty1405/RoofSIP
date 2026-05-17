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
    `Hi ${firstName}, this is Hailey, ${pmName}'s assistant. We're seeing ${eventType.toLowerCase()} activity near your home and want to make sure your roof is okay. Want us to stop by for a free inspection? Just reply YES.`,
    `Hey ${firstName}, Hailey here with ${pmName}'s team. With the recent ${eventType.toLowerCase()} in your area, we like to check in on our homeowners. Reply YES and I'll get you on the schedule for a free inspection.`,
    `Hi ${firstName}, it's Hailey. We noticed ${eventType.toLowerCase()} near your home and want to make sure there's no damage to your roof. Reply YES to book a free inspection at your convenience.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildBookingConfirmationSms(pmName: string, homeownerName: string, dateStr: string): string {
  const firstName = homeownerName.split(' ')[0]
  return `You're all set, ${firstName}! ${pmName} will stop by on ${dateStr} for your free roof inspection. See you then. Reply STOP to cancel.`
}
