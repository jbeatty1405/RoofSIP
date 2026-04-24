import { createClient } from '@/app/_lib/supabase/server'
import Link from 'next/link'

export default async function MarketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: markets } = await supabase
    .from('markets')
    .select('*, market_zips(zip_code)')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: true })

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Markets</h1>
          <p className="text-sm text-zinc-500 mt-1">Group ZIP codes into markets and control scheduling per area.</p>
        </div>
        <Link href="/markets/new" className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add market
        </Link>
      </div>

      {markets && markets.length > 0 ? (
        <div className="flex flex-col gap-4">
          {markets.map((m: any) => (
            <div key={m.id} className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-semibold text-white">{m.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.auto_schedule ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {m.auto_schedule ? 'Auto-schedule' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {m.working_days.map((d: number) => DAY_NAMES[d]).join(', ')} · {m.working_hours_start.slice(0, 5)} – {m.working_hours_end.slice(0, 5)}
                  </p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {m.market_zips?.map((z: any) => (
                      <span key={z.zip_code} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        {z.zip_code}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href={`/markets/${m.id}`} className="text-sm text-zinc-600 hover:text-zinc-200 font-medium transition-colors shrink-0 ml-4">
                  Edit →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-16 text-center">
          <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
          </div>
          <p className="text-zinc-200 font-semibold text-sm">No markets yet</p>
          <p className="text-zinc-600 text-xs mt-1 mb-5">Add markets to control scheduling by area.</p>
          <Link href="/markets/new" className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            Add your first market
          </Link>
        </div>
      )}
    </div>
  )
}
