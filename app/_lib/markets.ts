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
  if (slot.toDateString() === tomorrow.toDateString()) return `tomorrow at ${timeStr}`
  const day = slot.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} at ${timeStr}`
}

export async function getNextAvailableSlot(
  supabase: SupabaseClient,
  market: Market,
  roofer_id: string
): Promise<Date> {
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('blocked_date')
    .eq('roofer_id', roofer_id)
    .or(`market_id.eq.${market.id},market_id.is.null`)

  const blocked = new Set((blockedDates ?? []).map((b: any) => b.blocked_date))

  const [startHour, startMin] = market.working_hours_start.split(':').map(Number)

  const d = new Date()
  d.setDate(d.getDate() + 1)

  for (let i = 0; i < 30; i++) {
    const dayOfWeek = d.getDay()
    const dateStr = d.toISOString().slice(0, 10)

    if (market.working_days.includes(dayOfWeek) && !blocked.has(dateStr)) {
      const slot = new Date(d)
      slot.setHours(startHour, startMin, 0, 0)
      return slot
    }
    d.setDate(d.getDate() + 1)
  }

  // Fallback: next weekday at 10am
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + 1)
  while (fallback.getDay() === 0 || fallback.getDay() === 6) {
    fallback.setDate(fallback.getDate() + 1)
  }
  fallback.setHours(9, 0, 0, 0)
  return fallback
}
