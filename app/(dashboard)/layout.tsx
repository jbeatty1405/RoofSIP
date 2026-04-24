import { createClient } from '@/app/_lib/supabase/server'
import { redirect } from 'next/navigation'
import Logo from '@/app/_components/Logo'
import NotificationBell from '@/app/_components/NotificationBell'
import SignOutButton from '@/app/_components/SignOutButton'
import MobileNav from '@/app/_components/MobileNav'
import NavLink from '@/app/_components/NavLink'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user.id)
    .eq('read', false)

  const unread = unreadCount ?? 0

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-zinc-200 flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <Logo size="md" />
          <NotificationBell count={unread} />
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/map" label="Storm Map" />
          <NavLink href="/homeowners" label="Homeowners" />
          <NavLink href="/markets" label="Markets" />
          <NavLink href="/templates" label="Templates" />
          <NavLink href="/notifications" label="Notifications" badge={unread} />
          <NavLink href="/settings" label="Settings" />
        </nav>
        <div className="p-3 border-t border-zinc-200">
          <p className="text-xs text-zinc-400 px-3 mb-1 truncate">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200">
          <Logo size="sm" />
          <NotificationBell count={unread} />
        </header>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">{children}</main>

        {/* Mobile bottom nav */}
        <MobileNav unread={unread} />
      </div>
    </div>
  )
}
