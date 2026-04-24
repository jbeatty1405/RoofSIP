import { createClient } from '@/app/_lib/supabase/server'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  sms_sent: 'bg-sky-50 text-sky-700',
  booked: 'bg-green-50 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  sms_sent: 'SMS sent',
  booked: 'Booked',
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
      {initials}
    </div>
  )
}

export default async function HomeownersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Homeowners</h1>
          <p className="text-sm text-zinc-500 mt-1">{homeowners?.length ?? 0} total</p>
        </div>
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

      {homeowners && homeowners.length > 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          {/* Desktop table */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Phone</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Address</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">ZIP</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {homeowners.map((h: any) => (
                <tr key={h.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Initials name={h.name} />
                      <span className="text-sm font-medium text-zinc-900">{h.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <a href={`tel:${h.phone}`} className="text-sm text-zinc-600 hover:text-sky-600 transition-colors">{h.phone}</a>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-600">{h.address}</td>
                  <td className="px-5 py-3.5 text-sm text-zinc-600">{h.zip_code}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[h.status] ?? STATUS_COLOR.pending}`}>
                      {STATUS_LABEL[h.status] ?? 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/homeowners/${h.id}`} className="text-sm text-zinc-400 hover:text-zinc-900 font-medium transition-colors">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-zinc-100">
            {homeowners.map((h: any) => (
              <Link key={h.id} href={`/homeowners/${h.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-zinc-50 transition-colors">
                <Initials name={h.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{h.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{h.address}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[h.status] ?? STATUS_COLOR.pending}`}>
                  {STATUS_LABEL[h.status] ?? 'Pending'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="text-zinc-800 font-semibold text-sm">No homeowners yet</p>
          <p className="text-zinc-400 text-xs mt-1 mb-5">Add homeowners to start monitoring their area for storms.</p>
          <Link
            href="/homeowners/new"
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Add your first homeowner
          </Link>
        </div>
      )}
    </div>
  )
}
