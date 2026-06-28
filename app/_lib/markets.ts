import { SupabaseClient } from '@supabase/supabase-js'

export type Market = {
  id: string
  roofer_id: string
  name: string
  auto_schedule: boolean
  working_days: number[]
  working_hours_start: string
  working_hours_end: string
}

export async function getMarketById(
  supabase: SupabaseClient,
  marketId: string | null | undefined
): Promise<Market | null> {
  if (!marketId) return null
  const { data } = await supabase
    .from('markets')
    .select('*')
    .eq('id', marketId)
    .maybeSingle()

  return (data as Market) ?? null
}

// Fallback when a homeowner has no market assigned yet, so Hailey can still
// offer the next available time instead of dead-ending on "no schedule set".
// Standard Arizona business hours, Mon–Fri 8am–5pm. The id is the nil UUID so
// getNextAvailableSlot's blocked-dates lookup stays type-valid and matches
// nothing (a homeowner with no market has no per-market blocked dates anyway).
export const DEFAULT_MARKET: Market = {
  id: '00000000-0000-0000-0000-000000000000',
  roofer_id: '00000000-0000-0000-0000-000000000000',
  name: 'your area',
  auto_schedule: true,
  working_days: [1, 2, 3, 4, 5],
  working_hours_start: '08:00',
  working_hours_end: '17:00',
}

// Homeowners are in Arizona (MST year-round, UTC-7, no DST), but the server runs
// in UTC. All slot math and display must be done in Phoenix time, or a slot meant
// for 9am gets stored/shown as 2am. See PHOENIX_OFFSET_MS below for the math side.
const PHOENIX_TZ = 'America/Phoenix'
const PHOENIX_OFFSET_MS = 7 * 60 * 60 * 1000
// Shift an instant into a "Phoenix frame" where getUTC* fields read as Phoenix
// wall-clock; fromPhx converts a computed Phoenix-frame date back to a real UTC instant.
const toPhx = (d: Date) => new Date(d.getTime() - PHOENIX_OFFSET_MS)
const fromPhx = (d: Date) => new Date(d.getTime() + PHOENIX_OFFSET_MS)

export function formatSlot(slot: Date): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const dayKey = (d: Date) => d.toLocaleDateString('en-US', { timeZone: PHOENIX_TZ })
  const timeStr = slot.toLocaleTimeString('en-US', { timeZone: PHOENIX_TZ, hour: 'numeric', minute: '2-digit', hour12: true })
  if (dayKey(slot) === dayKey(now)) return `today at ${timeStr}`
  if (dayKey(slot) === dayKey(tomorrow)) return `tomorrow at ${timeStr}`
  const day = slot.toLocaleDateString('en-US', { timeZone: PHOENIX_TZ, weekday: 'long' })
  return `${day} at ${timeStr}`
}

// DB stores working_days as 1=Mon, 2=Tue, ..., 7=Sun
// JS getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
function jsToDbDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

export async function getNextAvailableSlot(
  supabase: SupabaseClient,
  market: Market,
  roofer_id: string
): Promise<Date> {
  const [startHour] = market.working_hours_start.split(':').map(Number)
  const [endHour] = market.working_hours_end.split(':').map(Number)
  // Last slot must end by working_hours_end, so last start = endHour - 1
  const lastSlotHour = endHour - 1

  // Work entirely in the Phoenix frame so getUTC*/setUTC* below read and write
  // Phoenix wall-clock; the returned slot is converted back to a real instant.
  const phxNow = toPhx(new Date())
  const currentHour = phxNow.getUTCHours()
  const todayStr = phxNow.toISOString().slice(0, 10)
  // Storm before 3pm → try same day; at/after 3pm → start from tomorrow
  const SAME_DAY_CUTOFF = 15

  // Fetch blocked dates
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('blocked_date')
    .eq('roofer_id', roofer_id)
    .or(`market_id.eq.${market.id},market_id.is.null`)
  const blocked = new Set((blockedDates ?? []).map((b: any) => b.blocked_date))

  // Fetch already offered/confirmed slots for this roofer (held slots count as taken)
  const { data: existingBookings } = await supabase
    .from('pending_bookings')
    .select('proposed_slot')
    .eq('roofer_id', roofer_id)
    .in('status', ['awaiting_ho_reply', 'confirmed'])
    .not('proposed_slot', 'is', null)

  const takenSlots = new Set(
    (existingBookings ?? []).map((b: any) => {
      const d = toPhx(new Date(b.proposed_slot))
      // Normalize to Phoenix YYYY-MM-DD-HH key for comparison
      return `${d.toISOString().slice(0, 10)}-${d.getUTCHours()}`
    })
  )

  const d = new Date(phxNow)
  // Only try same day if storm is before 3pm and there are still slots left today
  if (currentHour >= SAME_DAY_CUTOFF || currentHour >= lastSlotHour) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  d.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    const dbDay = jsToDbDay(d.getUTCDay())
    const dateStr = d.toISOString().slice(0, 10)

    if (market.working_days.includes(dbDay) && !blocked.has(dateStr)) {
      // Try each hour slot from start to last
      const firstHour = dateStr === todayStr
        ? Math.max(startHour, currentHour + 1) // same day: start after current hour
        : startHour

      for (let h = firstHour; h <= lastSlotHour; h++) {
        const slotKey = `${dateStr}-${h}`
        if (!takenSlots.has(slotKey)) {
          const slot = new Date(d)
          slot.setUTCHours(h, 0, 0, 0)
          return fromPhx(slot)
        }
      }
    }

    d.setUTCDate(d.getUTCDate() + 1)
  }

  // Fallback: next weekday at start hour (Phoenix)
  const fallback = toPhx(new Date())
  fallback.setUTCDate(fallback.getUTCDate() + 1)
  while ([0, 6].includes(fallback.getUTCDay())) {
    fallback.setUTCDate(fallback.getUTCDate() + 1)
  }
  fallback.setUTCHours(startHour, 0, 0, 0)
  return fromPhx(fallback)
}
