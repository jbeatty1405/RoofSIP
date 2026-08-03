import { hourIn, zipTimezone, FALLBACK_TZ } from '@/app/_lib/timezone'

// TCPA restricts marketing calls and texts to 8am-9pm **local to the person being
// contacted**. This used to be evaluated once, in America/Phoenix, for everyone —
// correct only while every homeowner was in Arizona. A homeowner in Virginia would
// have been texted at 9pm Phoenix, which is midnight their time.
//
// The window is now resolved per homeowner from their ZIP.

const OPEN_HOUR = 8
const CLOSE_HOUR = 21 // exclusive: the last minute we may send is 8:59pm

// When the ZIP lands in a state that straddles a timezone line, we cannot be sure
// which side of it the homeowner is on, so we give up the first and last hour of
// the window. An hour of reach is worth less than a $500-per-text mistake.
const UNSURE_OPEN_HOUR = 9
const UNSURE_CLOSE_HOUR = 20

/** Every timezone RoofSIP could plausibly need to be awake for. */
const US_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
]

function quietIn(tz: string, confident: boolean): boolean {
  const open = confident ? OPEN_HOUR : UNSURE_OPEN_HOUR
  const close = confident ? CLOSE_HOUR : UNSURE_CLOSE_HOUR
  const h = hourIn(tz)
  return h < open || h >= close
}

/**
 * Is it outside TCPA hours for the person at this ZIP right now?
 * Unknown or unparseable ZIPs fall back to a narrowed window in Mountain time,
 * which is never more than two hours off any real US zone.
 */
export function isQuietHoursForZip(zip: string | null | undefined): boolean {
  const { tz, confident } = zipTimezone(zip)
  return quietIn(tz, confident)
}

/** Same question for a known IANA timezone, e.g. the roofer's own. */
export function isQuietHoursIn(tz: string): boolean {
  return quietIn(tz, true)
}

/**
 * True only when it is quiet hours in every US timezone at once, i.e. there is
 * nobody in the country we could legally text. Lets the storm cron bail early
 * without assuming any single zone.
 */
export function isQuietHoursEverywhere(): boolean {
  return US_ZONES.every((tz) => quietIn(tz, true))
}

/**
 * Back-compatible default. Prefer isQuietHoursForZip — this one cannot know who
 * it is deciding for, so it answers for the fallback zone.
 */
export function isQuietHours(): boolean {
  return quietIn(FALLBACK_TZ, true)
}
