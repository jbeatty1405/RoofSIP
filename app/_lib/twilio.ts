import twilio from 'twilio'

export function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

export function buildWeatherSms(pmName: string, homeownerName: string, eventType: string, proposedTime: string): string {
  const firstName = homeownerName.split(' ')[0]
  const templates = [
    `Hey ${firstName}, Hailey here. We just had ${eventType.toLowerCase()} near your home. ${pmName} has you down for ${proposedTime} for a free roof check. Reply YES to confirm.`,
    `Hey ${firstName}, Hailey with ${pmName}'s team. There was ${eventType.toLowerCase()} near your home. ${pmName} is coming by ${proposedTime} for a free roof inspection. Reply YES to confirm.`,
    `Hey ${firstName}, it's Hailey. We just had ${eventType.toLowerCase()} in your area. ${pmName} has ${proposedTime} blocked for your free roof check. Reply YES to confirm.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

export function buildBookingConfirmationSms(pmName: string, homeownerName: string, dateStr: string): string {
  const firstName = homeownerName.split(' ')[0]
  return `You're all set, ${firstName}! ${pmName} will stop by on ${dateStr} for your free roof inspection. See you then. Reply STOP to cancel.`
}
