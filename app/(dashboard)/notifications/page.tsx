import { createClient } from '@/app/_lib/supabase/server'
import MarkReadButton from './MarkReadButton'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, homeowners(name, phone, address)')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const unread = notifications?.filter((n: any) => !n.read) ?? []
  const read = notifications?.filter((n: any) => n.read) ?? []

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Notifications</h1>
        {unread.length > 0 && (
          <p className="text-sm text-red-500 mt-1">{unread.length} need your attention</p>
        )}
      </div>

      {unread.length === 0 && read.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p className="text-zinc-800 font-semibold text-sm">You're all caught up</p>
          <p className="text-zinc-400 text-xs mt-1">Notifications appear here when homeowners need manual scheduling.</p>
        </div>
      )}

      {unread.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Action needed</h2>
          <div className="flex flex-col gap-3">
            {unread.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-red-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <p className="text-sm font-semibold text-zinc-900">{n.homeowners?.name}</p>
                    </div>
                    <a
                      href={`tel:${n.homeowners?.phone}`}
                      className="text-base font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-1.5 mt-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {n.homeowners?.phone}
                    </a>
                    <p className="text-xs text-zinc-500 mt-0.5">{n.homeowners?.address}</p>
                    <p className="text-sm text-zinc-600 mt-2">{n.message}</p>
                    <p className="text-xs text-zinc-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <MarkReadButton id={n.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {read.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Done</h2>
          <div className="flex flex-col gap-2">
            {read.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-zinc-100 p-4 opacity-50">
                <p className="text-sm font-medium text-zinc-700">{n.homeowners?.name}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
