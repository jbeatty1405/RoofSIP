// Returns true if current time is outside TCPA-allowed SMS hours (8am–9pm MST).
// 8am–9pm local is the federal TCPA window; homeowners are in Arizona, so we use
// Arizona time (MST year-round, no DST).
export function isQuietHours(): boolean {
  const h = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Phoenix',
      hour: 'numeric',
      hour12: false,
    })
  )
  return h < 8 || h >= 21
}
