// US timezone resolution.
//
// Everything in this app used to assume America/Phoenix, because every homeowner
// was in Arizona. That assumption is now wrong in two directions: a roofer can
// sign up from any state, and they can add homeowners anywhere. Getting it wrong
// on the homeowner side is not cosmetic — texting outside 8am-9pm *local to the
// recipient* is a TCPA violation at $500-$1,500 per message.
//
// ZIP is the most reliable location signal we hold: it is required on every
// homeowner and it is what we already geocode against. ZIP prefixes are assigned
// geographically, so a table of ZIP3 ranges resolves timezone well. It is not
// perfect at county lines inside split-timezone states, so `confident` is
// returned alongside and callers narrow their window when it is false.

export type TzResolution = {
  tz: string
  /** False when the ZIP falls in a state that straddles a timezone line and we had to pick. */
  confident: boolean
}

const ET = 'America/New_York'
const CT = 'America/Chicago'
const MT = 'America/Denver'
const AZ = 'America/Phoenix' // Mountain, but no DST
const PT = 'America/Los_Angeles'
const AK = 'America/Anchorage'
const HI = 'Pacific/Honolulu'
const PR = 'America/Puerto_Rico'

/**
 * ZIP3 ranges, low and high inclusive. Ordered; first match wins.
 * `split: true` marks ranges inside states that straddle a timezone boundary,
 * where the ZIP3 is a good guess but not a guarantee.
 */
const ZIP3_RANGES: Array<{ lo: number; hi: number; tz: string; split?: boolean }> = [
  { lo: 0, hi: 5, tz: ET },       // MA/military
  { lo: 6, hi: 9, tz: PR },       // Puerto Rico, US Virgin Islands
  { lo: 10, hi: 299, tz: ET },    // New England through the mid-Atlantic and Carolinas
  { lo: 300, hi: 349, tz: ET },   // GA, FL peninsula
  { lo: 350, hi: 369, tz: CT },   // AL
  { lo: 370, hi: 375, tz: CT, split: true },  // middle/west TN
  { lo: 376, hi: 379, tz: ET, split: true },  // east TN (Knoxville, Chattanooga, Tri-Cities)
  { lo: 380, hi: 385, tz: CT, split: true },  // west TN (Memphis, Jackson)
  { lo: 386, hi: 397, tz: CT },   // MS
  { lo: 398, hi: 399, tz: ET },   // south GA
  { lo: 400, hi: 419, tz: ET, split: true },  // central/east KY
  { lo: 420, hi: 427, tz: CT, split: true },  // west KY (Paducah, Bowling Green)
  { lo: 430, hi: 459, tz: ET },   // OH
  { lo: 460, hi: 462, tz: ET, split: true },  // Indianapolis
  { lo: 463, hi: 464, tz: CT, split: true },  // northwest IN (Gary, Hammond)
  { lo: 465, hi: 475, tz: ET, split: true },  // IN
  { lo: 476, hi: 477, tz: CT, split: true },  // southwest IN (Evansville)
  { lo: 478, hi: 479, tz: ET, split: true },  // IN
  { lo: 480, hi: 497, tz: ET, split: true },  // MI lower peninsula
  { lo: 498, hi: 499, tz: CT, split: true },  // western MI upper peninsula
  { lo: 500, hi: 528, tz: CT },   // IA
  { lo: 530, hi: 549, tz: CT },   // WI
  { lo: 550, hi: 567, tz: CT },   // MN
  { lo: 570, hi: 576, tz: CT, split: true },  // east SD
  { lo: 577, hi: 577, tz: MT, split: true },  // west SD (Rapid City)
  { lo: 580, hi: 585, tz: CT, split: true },  // east ND
  { lo: 586, hi: 588, tz: MT, split: true },  // west ND
  { lo: 590, hi: 599, tz: MT },   // MT
  { lo: 600, hi: 629, tz: CT },   // IL
  { lo: 630, hi: 658, tz: CT },   // MO
  { lo: 660, hi: 676, tz: CT, split: true },  // east KS
  { lo: 677, hi: 679, tz: MT, split: true },  // west KS
  { lo: 680, hi: 690, tz: CT, split: true },  // east NE
  { lo: 691, hi: 693, tz: MT, split: true },  // west NE
  { lo: 700, hi: 714, tz: CT },   // LA
  { lo: 716, hi: 729, tz: CT },   // AR
  { lo: 730, hi: 749, tz: CT },   // OK
  { lo: 750, hi: 797, tz: CT, split: true },  // TX
  { lo: 798, hi: 799, tz: MT, split: true },  // far west TX (El Paso)
  { lo: 800, hi: 816, tz: MT },   // CO
  { lo: 820, hi: 831, tz: MT },   // WY
  { lo: 832, hi: 837, tz: 'America/Boise', split: true }, // south ID
  { lo: 838, hi: 838, tz: PT, split: true },  // north ID panhandle is Pacific
  { lo: 840, hi: 847, tz: MT },   // UT
  { lo: 850, hi: 865, tz: AZ },   // AZ — Mountain time, no DST
  { lo: 870, hi: 884, tz: MT },   // NM
  { lo: 885, hi: 885, tz: MT },   // El Paso TX
  { lo: 889, hi: 898, tz: PT },   // NV
  { lo: 900, hi: 961, tz: PT },   // CA
  { lo: 967, hi: 968, tz: HI },   // HI
  { lo: 969, hi: 969, tz: 'Pacific/Guam' },
  { lo: 970, hi: 979, tz: PT },   // OR
  { lo: 980, hi: 994, tz: PT },   // WA
  { lo: 995, hi: 999, tz: AK },   // AK
]

/** Two-letter state to timezone. Used for the roofer's own account, where we know the
 *  billing state but not a ZIP. Split states resolve to their most populated zone. */
const STATE_TZ: Record<string, { tz: string; split?: boolean }> = {
  AL: { tz: CT }, AK: { tz: AK }, AZ: { tz: AZ }, AR: { tz: CT }, CA: { tz: PT },
  CO: { tz: MT }, CT: { tz: ET }, DE: { tz: ET }, DC: { tz: ET }, FL: { tz: ET, split: true },
  GA: { tz: ET }, HI: { tz: HI }, ID: { tz: 'America/Boise', split: true }, IL: { tz: CT },
  IN: { tz: ET, split: true }, IA: { tz: CT }, KS: { tz: CT, split: true },
  KY: { tz: ET, split: true }, LA: { tz: CT }, ME: { tz: ET }, MD: { tz: ET },
  MA: { tz: ET }, MI: { tz: ET, split: true }, MN: { tz: CT }, MS: { tz: CT },
  MO: { tz: CT }, MT: { tz: MT }, NE: { tz: CT, split: true }, NV: { tz: PT },
  NH: { tz: ET }, NJ: { tz: ET }, NM: { tz: MT }, NY: { tz: ET }, NC: { tz: ET },
  ND: { tz: CT, split: true }, OH: { tz: ET }, OK: { tz: CT }, OR: { tz: PT, split: true },
  PA: { tz: ET }, PR: { tz: PR }, RI: { tz: ET }, SC: { tz: ET }, SD: { tz: CT, split: true },
  TN: { tz: CT, split: true }, TX: { tz: CT, split: true }, UT: { tz: MT }, VT: { tz: ET },
  VA: { tz: ET }, WA: { tz: PT }, WV: { tz: ET }, WI: { tz: CT }, WY: { tz: MT },
}

/** When we cannot place someone at all. Mountain sits in the middle of the lower 48,
 *  so the error against any real US zone is at most two hours in either direction. */
export const FALLBACK_TZ = MT

export function zipTimezone(zip: string | null | undefined): TzResolution {
  const digits = String(zip ?? '').replace(/\D/g, '')
  if (digits.length < 3) return { tz: FALLBACK_TZ, confident: false }
  const zip3 = parseInt(digits.slice(0, 3), 10)
  if (Number.isNaN(zip3)) return { tz: FALLBACK_TZ, confident: false }
  for (const r of ZIP3_RANGES) {
    if (zip3 >= r.lo && zip3 <= r.hi) return { tz: r.tz, confident: !r.split }
  }
  return { tz: FALLBACK_TZ, confident: false }
}

export function stateTimezone(state: string | null | undefined): TzResolution {
  const code = String(state ?? '').trim().toUpperCase()
  const hit = STATE_TZ[code]
  if (!hit) return { tz: FALLBACK_TZ, confident: false }
  return { tz: hit.tz, confident: !hit.split }
}

/** Every zone this module can resolve to. Used to validate an explicitly stored
 *  setting, so a typo lands on the fallback instead of throwing inside Intl. */
const KNOWN_ZONES = new Set<string>([
  ...ZIP3_RANGES.map(r => r.tz),
  ...Object.values(STATE_TZ).map(s => s.tz),
  FALLBACK_TZ,
])

/**
 * The roofer's own timezone, for slot math and for anything shown to them.
 *
 * This used to read `profile.billing_state`, which sounds like a US state but is
 * the Stripe subscription status ('active' | 'past_due' | 'canceled') — the only
 * thing that ever writes it is the Stripe webhook. Every lookup missed and every
 * roofer silently resolved to the Mountain fallback, so from March to November
 * (Denver on DST, Phoenix never) every offered slot read one hour later than the
 * instant actually stored. There is no state column on profiles at all, so we
 * take the signal we do hold: the ZIP of the homeowner being scheduled, or the
 * roofer's homeowners in aggregate via `timezoneFromZips`.
 *
 * `profile.timezone` is honored first so an explicit per-roofer setting can be
 * added later without touching callers.
 */
export function rooferTimezone(
  profile: { timezone?: string | null } | null | undefined,
  fallbackZip?: string | null,
): string {
  const explicit = profile?.timezone?.trim()
  if (explicit && KNOWN_ZONES.has(explicit)) return explicit
  return zipTimezone(fallbackZip).tz
}

/**
 * One stable zone for a roofer, from the ZIPs of every homeowner they hold.
 * The slot grid has to be stable per roofer — deriving it from whichever
 * homeowner is being texted would shift a roofer's working hours mid-run if
 * their book ever straddles a timezone line. Most common zone wins; ties break
 * on first appearance, which keeps the result deterministic across runs.
 */
export function timezoneFromZips(zips: Iterable<string | null | undefined>): string {
  const counts = new Map<string, number>()
  for (const zip of zips) {
    const digits = String(zip ?? '').replace(/\D/g, '')
    if (digits.length < 3) continue
    const { tz } = zipTimezone(digits)
    counts.set(tz, (counts.get(tz) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [tz, n] of counts) {
    if (n > bestCount) { best = tz; bestCount = n }
  }
  return best ?? FALLBACK_TZ
}

/** Offset of `tz` from UTC at a given instant, in ms. Positive east of UTC. DST aware. */
export function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const f: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') f[p.type] = parseInt(p.value, 10)
  // hour can come back as 24 at midnight under hour12:false
  const asUTC = Date.UTC(f.year, f.month - 1, f.day, f.hour % 24, f.minute, f.second)
  return asUTC - at.getTime()
}

/**
 * The calendar date in `tz` as YYYY-MM-DD, for "have we already done this today?"
 * checks.
 *
 * Do NOT reach for `new Date().toISOString().slice(0, 10)` here. That is the UTC
 * date, and UTC midnight is 5pm in Phoenix, so a "once per day" guard built on it
 * rolls over mid-afternoon and lets the same work fire a second time before the
 * day is out. That is precisely what happened to the storm-lead dedup on
 * 2026-08-19: runs at 3:18pm and 5:54pm MST landed on opposite sides of the UTC
 * boundary and re-notified the whole book, ~98 leads twice.
 */
export function localDateKey(at: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a plain string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

/** The hour of day (0-23) in `tz` right now, or at `at`. */
export function hourIn(tz: string, at: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(at)
  return parseInt(h, 10) % 24
}

/**
 * Shift a real instant into a frame where the getUTC* accessors read as wall
 * clock in `tz`. Mirror of fromWallClock. Replaces the fixed 7-hour Phoenix
 * offset the scheduler used to hardcode, which silently broke under DST for
 * every timezone except Arizona's.
 */
export function toWallClock(d: Date, tz: string): Date {
  return new Date(d.getTime() + tzOffsetMs(tz, d))
}

/** Convert a wall-clock-framed date back to a real instant. */
export function fromWallClock(wall: Date, tz: string): Date {
  // The offset depends on the instant, which is what we are solving for, so
  // approximate once and refine. One pass is enough away from the DST seam and
  // lands on the correct side of it otherwise.
  const guess = new Date(wall.getTime() - tzOffsetMs(tz, wall))
  return new Date(wall.getTime() - tzOffsetMs(tz, guess))
}
