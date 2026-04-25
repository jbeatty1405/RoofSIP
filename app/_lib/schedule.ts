// Returns true if current time is outside allowed SMS sending hours.
// Uses Eastern Time as the reference — this means no texts before 8am ET (5am PT)
// or after 9pm ET (6pm PT), covering all major US timezones safely.
export function isQuietHours(): boolean {
  const h = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    })
  )
  return h < 8 || h >= 21
}
