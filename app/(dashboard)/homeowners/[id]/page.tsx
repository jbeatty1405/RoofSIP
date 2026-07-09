import { createClient } from '@/app/_lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteHomeownerButton from './DeleteHomeownerButton'
import NotesEditor from './NotesEditor'
import CompleteBookingButton from './CompleteBookingButton'

export default async function HomeownerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('*, markets(name)')
    .eq('id', id)
    .eq('roofer_id', user!.id)
    .single()

  if (!homeowner) notFound()

  const { data: smsLogs } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('homeowner_id', id)
    .order('created_at', { ascending: true })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('homeowner_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Homeowners
        </Link>
      </div>

      {homeowner.roof_photos?.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-6">
          {homeowner.roof_photos.map((url: string, i: number) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`Roof photo ${i + 1}`} className="w-28 h-28 object-cover rounded-xl border border-zinc-800 hover:opacity-80 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{homeowner.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{homeowner.address}</p>
        </div>
        <DeleteHomeownerButton id={homeowner.id} />
      </div>

      {/* Details */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-4">
        <h2 className="font-semibold text-zinc-200 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Phone</dt>
            <dd className="text-sm text-zinc-300 mt-1">
              {homeowner.phone
                ? <a href={`tel:${homeowner.phone}`} className="hover:text-sky-400 transition-colors">{homeowner.phone}</a>
                : <span className="text-zinc-500">No phone — monitoring only</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Market</dt>
            <dd className="text-sm text-zinc-300 mt-1">{(homeowner as any).markets?.name ?? <span className="text-zinc-500">None</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Consent</dt>
            <dd className="text-sm text-zinc-300 mt-1">
              {homeowner.tcpa_consent ? (
                <span className="text-green-400">Opted in · {new Date(homeowner.tcpa_consent_at).toLocaleDateString()}</span>
              ) : (
                <span className="text-zinc-500">Pending</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Added</dt>
            <dd className="text-sm text-zinc-300 mt-1">{new Date(homeowner.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Notes */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-4">
        <h2 className="font-semibold text-zinc-200 mb-3">Notes</h2>
        <NotesEditor homeownerId={homeowner.id} initial={(homeowner as any).notes ?? null} />
      </div>

      {/* Bookings */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-4">
        <h2 className="font-semibold text-zinc-200 mb-4">Inspections</h2>
        {bookings && bookings.length > 0 ? (
          <div className="flex flex-col gap-1">
            {bookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                <span className="text-sm text-zinc-300">
                  {new Date(b.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {b.status === 'scheduled' && <CompleteBookingButton bookingId={b.id} />}
                  {b.status === 'completed' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">Completed</span>
                  )}
                  {b.status !== 'scheduled' && b.status !== 'completed' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500">{b.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No inspections yet.</p>
        )}
      </div>

      {/* SMS Thread */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h2 className="font-semibold text-zinc-200 mb-4">Messages</h2>
        {smsLogs && smsLogs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {smsLogs.map((s: any) => {
              const isOutbound = s.direction === 'outbound'
              return (
                <div key={s.id} className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isOutbound
                        ? 'bg-sky-600 text-white rounded-br-sm'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                    }`}
                  >
                    {s.message}
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 px-1">
                    {new Date(s.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No messages yet.</p>
        )}
      </div>
    </div>
  )
}
