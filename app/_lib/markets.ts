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

export async function getMarketForZip(
  supabase: SupabaseClient,
  zip: string
): Promise<Market | null> {
  const { data } = await supabase
    .from('market_zips')
    .select('markets(*)')
    .eq('zip_code', zip)
    .limit(1)
    .maybeSingle()

  return (data?.markets as unknown as Market) ?? null
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
  fallback.setHours(10, 0, 0, 0)
  return fallback
}
