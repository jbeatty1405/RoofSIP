import { createClient } from '@/app/_lib/supabase/server'
import StormMap from './StormMap'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('id, name, phone, address, zip_code')
    .eq('roofer_id', user!.id)

  const { data: smsToday } = await supabase
    .from('sms_logs')
    .select('homeowner_id')
    .eq('roofer_id', user!.id)
    .eq('direction', 'outbound')
    .gte('sent_at', new Date().toISOString().slice(0, 10) + 'T00:00:00Z')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('homeowner_id')
    .eq('roofer_id', user!.id)
    .gte('scheduled_at', new Date().toISOString())

  const smsSentIds = new Set((smsToday ?? []).map((s: any) => s.homeowner_id))
  const bookedIds = new Set((bookings ?? []).map((b: any) => b.homeowner_id))

  const enriched = (homeowners ?? []).map((h: any) => ({
    ...h,
    status: bookedIds.has(h.id) ? 'booked' : smsSentIds.has(h.id) ? 'sms_sent' : 'pending',
  }))

  return (
    <div className="h-full flex flex-col -m-8">
      <div className="px-8 py-5 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Storm Map</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Live NOAA alerts overlaid with your homeowner locations</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-400 inline-block" />No alert</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />Alert active</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />SMS sent</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Booked</span>
        </div>
      </div>
      <div className="flex-1">
        <StormMap homeowners={enriched} />
      </div>
    </div>
  )
}
