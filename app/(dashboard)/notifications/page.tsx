import { createClient } from '@/app/_lib/supabase/server'
import NotificationsList, { type Notification } from './NotificationsList'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('notifications')
    .select('id, type, message, read, created_at, dismissed_at, homeowner_id, homeowners(name, phone, address)')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const notifications = (data as unknown as Notification[]) ?? []
  const active = notifications.filter(n => !n.dismissed_at)

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        {active.length > 0 && (
          <p className="text-sm text-zinc-500 mt-1">{active.length} need your attention</p>
        )}
      </div>

      <NotificationsList notifications={notifications} />
    </div>
  )
}
