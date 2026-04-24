import { createClient } from '@/app/_lib/supabase/server'
import Link from 'next/link'

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
        <h1 className="text-2xl font-bold text-zinc-900">Homeowners</h1>
        <Link
          href="/homeowners/new"
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          Add homeowner
        </Link>
      </div>

      {homeowners && homeowners.length > 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase px-5 py-3">Phone</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase px-5 py-3">Address</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase px-5 py-3">ZIP</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase px-5 py-3">Consent</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {homeowners.map((h: any) => (
                <tr key={h.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-5 py-3 text-sm font-medium text-zinc-900">{h.name}</td>
                  <td className="px-5 py-3 text-sm text-zinc-600">{h.phone}</td>
                  <td className="px-5 py-3 text-sm text-zinc-600">{h.address}</td>
                  <td className="px-5 py-3 text-sm text-zinc-600">{h.zip_code}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${h.tcpa_consent ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {h.tcpa_consent ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/homeowners/${h.id}`} className="text-sm text-zinc-500 hover:text-zinc-900 underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-zinc-500 text-sm">No homeowners yet.</p>
          <Link
            href="/homeowners/new"
            className="inline-block mt-4 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Add your first homeowner
          </Link>
        </div>
      )}
    </div>
  )
}
