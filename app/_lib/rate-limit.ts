import type { SupabaseClient } from '@supabase/supabase-js'

export async function homeownerCreatesLast24h(
  supabase: SupabaseClient,
  rooferId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('homeowners')
    .select('id', { count: 'exact', head: true })
    .eq('roofer_id', rooferId)
    .gte('created_at', since)
  return count ?? 0
}

export const HOMEOWNER_DAILY_LIMIT = 50

export function tryParseTimeFast(reply: string, proposed: Date): Date | null {
  const s = reply.trim().toLowerCase()
  if (s.length > 80) return null

  const m = s.match(/^(?:tomorrow|tmrw)?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/)
  if (!m) return null

  let hour = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]
  if (hour > 23 || min > 59) return null
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0

  const d = new Date(proposed)
  if (/tomorrow|tmrw/.test(s)) {
    d.setDate(d.getDate() + 1)
  }
  d.setHours(hour, min, 0, 0)
  return d
}
