import { SupabaseClient } from '@supabase/supabase-js'
import { toWallClock, fromWallClock } from './timezone'

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
// The roofer's own hours, set in Settings. Markets are gone, so this is the
// schedule every homeowner is booked against. Falls back to DEFAULT_MARKET when
// the profile row is missing, so scheduling can never dead-end.
export async function getRooferSchedule(
  supabase: SupabaseClient,
  rooferId: string
): Promise<Market> {
  const { data } = await supabase
    .from('profiles')
    .select('working_days, working_hours_start, working_hours_end')
    .eq('id', rooferId)
    .maybeSingle()

  if (!data?.working_days?.length) return DEFAULT_MARKET

  return {
    ...DEFAULT_MARKET,
    roofer_id: rooferId,
    working_days: data.working_days,
    working_hours_start: data.working_hours_start ?? DEFAULT_MARKET.working_hours_start,
    working_hours_end: data.working_hours_end ?? DEFAULT_MARKET.working_hours_end,
  }
}

export const DEFAULT_MARKET: Market = {
  id: '00000000-0000-0000-0000-000000000000',
  roofer_id: '00000000-0000-0000-0000-000000000000',
  name: 'your area',
  auto_schedule: true,
  working_days: [1, 2, 3, 4, 5],
  working_hours_start: '08:00',
  working_hours_end: '17:00',
}

// The server runs in UTC, so all slot math and display has to happen in the
// roofer's wall clock or a slot meant for 9am gets stored and shown as 2am.
//
// This used to be hardcoded to Phoenix with a fixed 7-hour offset, which was only
// ever right because Arizona has no DST. A roofer in Texas would have been booked
// an hour off for half the year. Callers now pass their own zone; the offset is
// resolved per instant, so DST transitions are handled.
export const DEFAULT_TZ = 'America/Phoenix'

export function formatSlot(slot: Date, tz: string = DEFAULT_TZ): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const dayKey = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz })
  const timeStr = slot.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  if (dayKey(slot) === dayKey(now)) return `today at ${timeStr}`
  if (dayKey(slot) === dayKey(tomorrow)) return `tomorrow at ${timeStr}`
  const day = slot.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
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
  roofer_id: string,
  tz: string = DEFAULT_TZ
): Promise<Date> {
  const toLocal = (d: Date) => toWallClock(d, tz)
  const fromLocal = (d: Date) => fromWallClock(d, tz)
  const [startHour] = market.working_hours_start.split(':').map(Number)
  const [endHour] = market.working_hours_end.split(':').map(Number)
  // Last slot must end by working_hours_end, so last start = endHour - 1
  const lastSlotHour = endHour - 1

  // Work entirely in the roofer's wall-clock frame so getUTC*/setUTC* below read
  // and write local time; the returned slot is converted back to a real instant.
  const phxNow = toLocal(new Date())
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
      const d = toLocal(new Date(b.proposed_slot))
      // Normalize to a local YYYY-MM-DD-HH key for comparison
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
          return fromLocal(slot)
        }
      }
    }

    d.setUTCDate(d.getUTCDate() + 1)
  }

  // Fallback: next weekday at start hour, in the roofer's zone
  const fallback = toLocal(new Date())
  fallback.setUTCDate(fallback.getUTCDate() + 1)
  while ([0, 6].includes(fallback.getUTCDay())) {
    fallback.setUTCDate(fallback.getUTCDate() + 1)
  }
  fallback.setUTCHours(startHour, 0, 0, 0)
  return fromLocal(fallback)
}
