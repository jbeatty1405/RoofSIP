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

export function formatSlot(slot: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const timeStr = slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (slot.toDateString() === now.toDateString()) return `today at ${timeStr}`
  if (slot.toDateString() === tomorrow.toDateString()) return `tomorrow at ${timeStr}`
  const day = slot.toLocaleDateString('en-US', { weekday: 'long' })
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

  const now = new Date()
  const currentHour = now.getHours()
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
      const d = new Date(b.proposed_slot)
      // Normalize to YYYY-MM-DD-HH key for comparison
      return `${d.toISOString().slice(0, 10)}-${d.getHours()}`
    })
  )

  const d = new Date(now)
  // Only try same day if storm is before 3pm and there are still slots left today
  if (currentHour >= SAME_DAY_CUTOFF || currentHour >= lastSlotHour) {
    d.setDate(d.getDate() + 1)
  }
  d.setHours(0, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    const dbDay = jsToDbDay(d.getDay())
    const dateStr = d.toISOString().slice(0, 10)

    if (market.working_days.includes(dbDay) && !blocked.has(dateStr)) {
      // Try each hour slot from start to last
      const firstHour = d.toDateString() === now.toDateString()
        ? Math.max(startHour, currentHour + 1) // same day: start after current hour
        : startHour

      for (let h = firstHour; h <= lastSlotHour; h++) {
        const slotKey = `${dateStr}-${h}`
        if (!takenSlots.has(slotKey)) {
          const slot = new Date(d)
          slot.setHours(h, 0, 0, 0)
          return slot
        }
      }
    }

    d.setDate(d.getDate() + 1)
  }

  // Fallback: next weekday at start hour
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + 1)
  while ([0, 6].includes(fallback.getDay())) {
    fallback.setDate(fallback.getDate() + 1)
  }
  fallback.setHours(startHour, 0, 0, 0)
  return fallback
}
