import { createClient } from '@/app/_lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteHomeownerButton from './DeleteHomeownerButton'

export default async function HomeownerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('*')
    .eq('id', id)
    .eq('roofer_id', user!.id)
    .single()

  if (!homeowner) notFound()

  const { data: smsLogs } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('homeowner_id', id)
    .order('sent_at', { ascending: false })
    .limit(20)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('homeowner_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Homeowners
        </Link>
      </div>

      {homeowner.roof_photos?.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-3 flex-wrap">
            {homeowner.roof_photos.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Roof photo ${i + 1}`} className="w-28 h-28 object-cover rounded-xl border border-zinc-200 hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{homeowner.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{homeowner.address}</p>
        </div>
        <DeleteHomeownerButton id={homeowner.id} />
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
        <h2 className="font-semibold text-zinc-900 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium">Phone</dt>
            <dd className="text-sm text-zinc-900 mt-1">{homeowner.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium">ZIP code</dt>
            <dd className="text-sm text-zinc-900 mt-1">{homeowner.zip_code}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium">TCPA consent</dt>
            <dd className="text-sm text-zinc-900 mt-1">
              {homeowner.tcpa_consent ? (
                <span>Yes — {new Date(homeowner.tcpa_consent_at).toLocaleDateString()}</span>
              ) : 'No'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium">Added</dt>
            <dd className="text-sm text-zinc-900 mt-1">{new Date(homeowner.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
        <h2 className="font-semibold text-zinc-900 mb-4">Bookings</h2>
        {bookings && bookings.length > 0 ? (
          <div className="flex flex-col gap-2">
            {bookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                <span className="text-sm text-zinc-900">
                  {new Date(b.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No bookings yet.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <h2 className="font-semibold text-zinc-900 mb-4">SMS history</h2>
        {smsLogs && smsLogs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {smsLogs.map((s: any) => (
              <div key={s.id} className="py-2 border-b border-zinc-100 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.direction === 'inbound' ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                    {s.direction}
                  </span>
                  <span className="text-xs text-zinc-400">{new Date(s.sent_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-zinc-700">{s.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No messages yet.</p>
        )}
      </div>
    </div>
  )
}
