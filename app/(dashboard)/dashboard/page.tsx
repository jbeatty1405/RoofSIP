import { createClient } from '@/app/_lib/supabase/server'
import SubscribeBanner from './SubscribeBanner'
import OnboardingChecklist from '@/app/_components/OnboardingChecklist'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('pm_name, company_name, stripe_customer_id, subscription_status, google_access_token')
    .eq('id', user!.id)
    .single()

  const { count: templateCount } = await supabase
    .from('sms_templates')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)

  const { count: marketCount } = await supabase
    .from('markets')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)

  const { count: homeownerCount } = await supabase
    .from('homeowners')
    .select('*', { count: 'exact', head: true })
    .eq('roofer_id', user!.id)

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

  const isTrial = profile?.subscription_status !== 'active'

  const onboardingSteps = [
    {
      label: 'Add your first homeowner',
      description: 'Start building your customer database.',
      href: '/homeowners/new',
      done: (homeownerCount ?? 0) > 0,
    },
    {
      label: 'Create a market',
      description: 'Group ZIP codes and set scheduling rules per area.',
      href: '/markets/new',
      done: (marketCount ?? 0) > 0,
    },
    {
      label: 'Set up message templates',
      description: 'Customize the SMS your homeowners receive after a storm.',
      href: '/templates',
      done: (templateCount ?? 0) > 0,
    },
    {
      label: 'Connect Google Calendar',
      description: 'Auto-book inspections directly to your calendar.',
      href: '/settings',
      done: !!profile?.google_access_token,
    },
    {
      label: 'Activate your subscription',
      description: 'Start your 60-day free trial to enable storm alerts.',
      href: '/settings',
      done: !isTrial,
    },
  ]

  return (
    <div>
      <OnboardingChecklist steps={onboardingSteps} />

      {isTrial && (
        <SubscribeBanner userId={user!.id} stripeCustomerId={profile?.stripe_customer_id} />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">
          Welcome back{profile?.pm_name ? `, ${profile.pm_name}` : ''}
        </h1>
        {profile?.company_name && (
          <p className="text-zinc-500 text-sm mt-1">{profile.company_name}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-sm text-zinc-500">Homeowners</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{homeownerCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-sm text-zinc-500">Inspections this month</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{inspectionsThisMonth ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-sm text-zinc-500">Action needed</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{unreadNotifications ?? 0}</p>
          {(unreadNotifications ?? 0) > 0 && (
            <p className="text-xs text-sky-500 mt-1">homeowners to call</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <h2 className="font-semibold text-zinc-900 mb-4">Upcoming inspections</h2>
        {recentBookings && recentBookings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {recentBookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{b.homeowners?.name}</p>
                  <p className="text-xs text-zinc-500">{b.homeowners?.address}</p>
                </div>
                <p className="text-sm text-zinc-700">
                  {new Date(b.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No upcoming inspections.</p>
        )}
      </div>
    </div>
  )
}
