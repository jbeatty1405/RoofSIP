import { createClient } from '@/app/_lib/supabase/server'
import SubscribeBanner from './SubscribeBanner'
import HaileyBanner from './HaileyBanner'
import Link from 'next/link'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('pm_name, company_name, stripe_customer_id, subscription_status, google_access_token')
    .eq('id', user!.id)
    .single()

  const { count: homeownerCount } = await supabase
    .from('homeowners')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)

  const { count: optedInCount } = await supabase
    .from('homeowners')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)
    .eq('tcpa_consent', true)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: inspectionsThisMonth } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)
    .gte('created_at', monthStart.toISOString())

  const { count: unreadNotifications } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)
    .eq('read', false)

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('*, homeowners(name, address)')
    .eq('roofer_id', user!.id)
    .order('scheduled_at', { ascending: true })
    .gte('scheduled_at', new Date().toISOString())
    .limit(5)

  const { data: lastSms } = await supabase
    .from('sms_logs')
    .select('created_at')
    .eq('roofer_id', user!.id)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isTrial = profile?.subscription_status !== 'active'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  let recentActivity: string | undefined
  if (lastSms?.created_at) {
    const days = Math.floor((Date.now() - new Date(lastSms.created_at).getTime()) / 86400000)
    recentActivity = days === 0
      ? 'Last alert sent today.'
      : days === 1
      ? 'Last alert sent yesterday.'
      : `Last alert sent ${days} days ago.`
  }

  return (
    <div>
      {isTrial && <SubscribeBanner userId={user!.id} stripeCustomerId={profile?.stripe_customer_id} />}

      <HaileyBanner recentActivity={recentActivity} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting}{profile?.pm_name ? `, ${profile.pm_name}` : ''}
        </h1>
        {profile?.company_name && <p className="text-zinc-500 text-sm mt-1">{profile.company_name}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/homeowners" className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-sky-800 hover:shadow-lg hover:shadow-sky-950/50 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Homeowners</p>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{homeownerCount ?? 0}</p>
        </Link>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Inspections this month</p>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{inspectionsThisMonth ?? 0}</p>
        </div>

        <Link href="/notifications" className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-red-900 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Action needed</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${(unreadNotifications ?? 0) > 0 ? 'bg-red-500/10' : 'bg-zinc-800'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={(unreadNotifications ?? 0) > 0 ? '#f87171' : '#52525b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{unreadNotifications ?? 0}</p>
          {(unreadNotifications ?? 0) > 0 && <p className="text-xs text-red-400 mt-1">homeowners to call</p>}
        </Link>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-500">Opt-in rate</p>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            {homeownerCount ? `${Math.round(((optedInCount ?? 0) / homeownerCount) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">{optedInCount ?? 0} of {homeownerCount ?? 0} opted in</p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Upcoming inspections</h2>
          {recentBookings && recentBookings.length > 0 && (
            <span className="text-xs text-zinc-600">{recentBookings.length} scheduled</span>
          )}
        </div>
        {recentBookings && recentBookings.length > 0 ? (
          <div className="flex flex-col">
            {recentBookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{b.homeowners?.name}</p>
                    <p className="text-xs text-zinc-600">{b.homeowners?.address}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 shrink-0 ml-4">
                  {new Date(b.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-sm text-zinc-600">No upcoming inspections</p>
          </div>
        )}
      </div>
    </div>
  )
}
