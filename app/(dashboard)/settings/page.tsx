import { createClient } from '@/app/_lib/supabase/server'
import { getGoogleAuthUrl } from '@/app/_lib/google'
import ConnectGoogleButton from './ConnectGoogleButton'
import ManageBillingButton from './ManageBillingButton'
import MessageStyleForm from './MessageStyleForm'
import SignOutButton from '@/app/_components/SignOutButton'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const googleAuthUrl = getGoogleAuthUrl(user!.id)

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Settings</h1>

      {params.success === 'google' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          Google Calendar connected successfully.
        </div>
      )}
      {params.error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-1">Account</h2>
          <p className="text-sm text-zinc-500 mb-4">{user?.email}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-zinc-500 uppercase font-medium">Your name</dt>
              <dd className="text-sm text-zinc-900 mt-1">{profile?.pm_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 uppercase font-medium">Company</dt>
              <dd className="text-sm text-zinc-900 mt-1">{profile?.company_name || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-1">Google Calendar</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Connect your Google Calendar so inspection bookings are added automatically.
          </p>
          {profile?.google_access_token ? (
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Connected</span>
              <ConnectGoogleButton url={googleAuthUrl} label="Reconnect" />
            </div>
          ) : (
            <ConnectGoogleButton url={googleAuthUrl} label="Connect Google Calendar" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-1">Message style</h2>
          <p className="text-xs text-zinc-400 mb-4">Powered by AI — each text is written fresh, never a copy-paste template.</p>
          <MessageStyleForm userId={user!.id} initial={profile?.message_style ?? null} />
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-1">Subscription</h2>
          <p className="text-sm text-zinc-500 mb-4">$20/month · 250 SMS/month included</p>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              profile?.subscription_status === 'active'
                ? 'bg-green-50 text-green-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}>
              {profile?.subscription_status === 'active' ? 'Active' : 'Inactive'}
            </span>
            {profile?.stripe_customer_id && (
              <ManageBillingButton customerId={profile.stripe_customer_id} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 md:hidden">
        <SignOutButton />
      </div>
    </div>
  )
}
