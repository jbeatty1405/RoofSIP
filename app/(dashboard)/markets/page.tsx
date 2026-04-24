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
          <h1 className="text-2xl font-bold text-zinc-900">Markets</h1>
          <p className="text-sm text-zinc-500 mt-1">Group ZIP codes into markets and control scheduling per area.</p>
        </div>
        <Link
          href="/markets/new"
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          Add market
        </Link>
      </div>

      {markets && markets.length > 0 ? (
        <div className="flex flex-col gap-4">
          {markets.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-semibold text-zinc-900">{m.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.auto_schedule ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {m.auto_schedule ? 'Auto-schedule on' : 'Manual scheduling'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {m.working_days.map((d: number) => DAY_NAMES[d]).join(', ')} · {m.working_hours_start.slice(0, 5)} – {m.working_hours_end.slice(0, 5)}
                  </p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {m.market_zips?.map((z: any) => (
                      <span key={z.zip_code} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                        {z.zip_code}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href={`/markets/${m.id}`} className="text-sm text-zinc-500 hover:text-zinc-900 underline shrink-0 ml-4">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-zinc-500 text-sm">No markets yet.</p>
          <p className="text-zinc-400 text-xs mt-1 mb-4">Add markets to control scheduling by area.</p>
          <Link
            href="/markets/new"
            className="inline-block bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Add your first market
          </Link>
        </div>
      )}
    </div>
  )
}
