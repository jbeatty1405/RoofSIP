import { createClient } from '@/app/_lib/supabase/server'
import NotificationsList, { type Notification } from './NotificationsList'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Open and handled are loaded separately. One newest-100 query hid open leads
  // once handled ones piled up (2026-11-01: two roofers had 114 and 132 open).
  const cols = 'id, type, message, read, created_at, dismissed_at, homeowner_id, homeowners(name, phone, address)'
  const [{ data: open }, { data: handled }] = await Promise.all([
    supabase.from('notifications').select(cols).eq('roofer_id', user!.id).is('dismissed_at', null)
      .order('created_at', { ascending: false }).limit(1000),
    supabase.from('notifications').select(cols).eq('roofer_id', user!.id).not('dismissed_at', 'is', null)
      .order('created_at', { ascending: false }).limit(100),
  ])

  const notifications = [...(open ?? []), ...(handled ?? [])] as unknown as Notification[]
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
