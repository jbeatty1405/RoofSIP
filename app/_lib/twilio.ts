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
    `Hi ${firstName}, this is ${pmName} from our roofing team. We're seeing ${eventType.toLowerCase()} activity in your area and wanted to check in on your roof. Would you like us to stop by for a free inspection? Just reply YES to pick a time.`,
    `Hey ${firstName} — ${pmName} here. With the recent ${eventType.toLowerCase()} in your area, we like to make sure our homeowners' roofs are in good shape. Reply YES and I'll get you on the schedule for a free inspection.`,
    `Hi ${firstName}, it's ${pmName}. We noticed ${eventType.toLowerCase()} conditions near your home and want to make sure there's no damage to your roof. Reply YES to book a free inspection at your convenience.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildBookingConfirmationSms(pmName: string, homeownerName: string, dateStr: string): string {
  const firstName = homeownerName.split(' ')[0]
  return `Hi ${firstName}, you're all set! ${pmName} will stop by on ${dateStr} for your free roof inspection. See you then — reply STOP to cancel.`
}
