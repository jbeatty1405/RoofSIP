import { createClient } from '@/app/_lib/supabase/server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-zinc-800 text-zinc-400',
  sms_sent: 'bg-sky-500/10 text-sky-400',
  booked: 'bg-green-500/10 text-green-400',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  sms_sent: 'SMS sent',
  booked: 'Booked',
}

function StatusBadge({ h }: { h: any }) {
  if (h.monitor_only) {
    return <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/10 text-amber-400">Monitor only</span>
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[h.status] ?? STATUS_COLOR.pending}`}>
      {STATUS_LABEL[h.status] ?? 'Pending'}
    </span>
  )
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
      {initials}
    </div>
  )
}

export default async function HomeownersPage({ searchParams }: { searchParams: Promise<{ deferred?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*, markets(name)')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: false })

  const active = homeowners?.filter((h: any) => h.tcpa_consent !== false || !h.tcpa_consent_at) ?? []
  const optedOut = homeowners?.filter((h: any) => h.tcpa_consent === false && h.tcpa_consent_at) ?? []

  return (
    <div>
      {params.deferred && (
        <div className="mb-6 bg-sky-500/10 border border-sky-500/30 rounded-lg px-4 py-3 text-sm text-sky-400">
          Homeowner added — it's outside sending hours, so their opt-in text will go out automatically this morning.
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Homeowners</h1>
          <p className="text-sm text-zinc-500 mt-1">{homeowners?.length ?? 0} total{optedOut.length > 0 ? ` · ${optedOut.length} opted out` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/homeowners/import"
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-700 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </Link>
          <a
            href="/api/homeowners/export"
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-sm font-medium hover:bg-zinc-700 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </a>
          <Link
            href="/homeowners/new"
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add homeowner
          </Link>
        </div>
      </div>

      {active.length > 0 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-6">
          <table className="w-full hidden md:table">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Phone</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Address</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Market</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {active.map((h: any) => (
                <tr key={h.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Initials name={h.name} />
                      <span className="text-sm font-medium text-zinc-200">{h.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {h.phone
                      ? <a href={`tel:${h.phone}`} className="text-sm text-zinc-400 hover:text-sky-400 transition-colors">{h.phone}</a>
                      : <span className="text-sm text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400">{h.address}</td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400">{(h as any).markets?.name ?? <span className="text-zinc-600">—</span>}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge h={h} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/homeowners/${h.id}`} className="text-sm text-zinc-600 hover:text-zinc-200 font-medium transition-colors">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden divide-y divide-zinc-800">
            {active.map((h: any) => (
              <Link key={h.id} href={`/homeowners/${h.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-zinc-800/50 transition-colors">
                <Initials name={h.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{h.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{h.address}</p>
                </div>
                <StatusBadge h={h} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-16 text-center mb-6">
          <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <p className="text-zinc-200 font-semibold text-sm">No homeowners yet</p>
          <p className="text-zinc-600 text-xs mt-1 mb-5">Add homeowners to start monitoring their area for storms.</p>
          <Link href="/homeowners/new" className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            Add your first homeowner
          </Link>
        </div>
      )}

      {optedOut.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3">Opted out ({optedOut.length})</h2>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden opacity-50">
            <div className="divide-y divide-zinc-800">
              {optedOut.map((h: any) => (
                <Link key={h.id} href={`/homeowners/${h.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                    {h.name.trim().split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-400 truncate">{h.name}</p>
                    <p className="text-xs text-zinc-600 truncate">{h.address}</p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0">Opted out</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
