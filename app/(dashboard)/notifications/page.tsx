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
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Notifications</h1>

      {unread.length === 0 && read.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-zinc-500 text-sm">No notifications yet.</p>
          <p className="text-zinc-400 text-xs mt-1">When a homeowner replies YES in a manual-schedule market, you'll get a notification here.</p>
        </div>
      )}

      {unread.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Action needed</h2>
          <div className="flex flex-col gap-3">
            {unread.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-sky-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-900">{n.homeowners?.name}</p>
                    <p className="text-sm text-sky-600 font-medium mt-0.5">{n.homeowners?.phone}</p>
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
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Done</h2>
          <div className="flex flex-col gap-2">
            {read.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-zinc-200 p-4 opacity-60">
                <p className="text-sm font-medium text-zinc-900">{n.homeowners?.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
