import { createClient } from '@/app/_lib/supabase/server'
import { getGoogleAuthUrl } from '@/app/_lib/google'
import ConnectGoogleButton from './ConnectGoogleButton'
import ManageBillingButton from './ManageBillingButton'
import CancelSubscriptionButton from './CancelSubscriptionButton'
import MessageStyleForm from './MessageStyleForm'
import SignOutButton from '@/app/_components/SignOutButton'
import PmContactForm from './PmContactForm'
import ChangePasswordForm from './ChangePasswordForm'
import FeedbackForm from './FeedbackForm'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const googleAuthUrl = getGoogleAuthUrl(user!.id)

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {params.success === 'google' && (
        <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-sm text-green-400">
          Google Calendar connected successfully.
        </div>
      )}
      {params.error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Account</h2>
          <p className="text-sm text-zinc-500 mb-4">{user?.email}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Your name</dt>
              <dd className="text-sm text-zinc-300 mt-1">{profile?.pm_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 uppercase font-medium tracking-wide">Company</dt>
              <dd className="text-sm text-zinc-300 mt-1">{profile?.company_name || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Password</h2>
          <p className="text-xs text-zinc-600 mb-4">Change the password you use to sign in.</p>
          <ChangePasswordForm />
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Your contact info</h2>
          <p className="text-xs text-zinc-600 mb-4">How we reach you when a homeowner books an inspection.</p>
          <PmContactForm userId={user!.id} initialPhone={profile?.pm_phone ?? null} initialEmail={profile?.pm_email ?? null} />
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Message style</h2>
          <p className="text-xs text-zinc-600 mb-4">Powered by AI — each text is written fresh, never a copy-paste template.</p>
          <MessageStyleForm userId={user!.id} initial={profile?.message_style ?? null} />
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Google Calendar</h2>
          <p className="text-sm text-zinc-500 mb-4">Connect your Google Calendar so inspection bookings are added automatically.</p>
          {profile?.google_access_token ? (
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Connected</span>
              <ConnectGoogleButton url={googleAuthUrl} label="Reconnect" />
            </div>
          ) : (
            <ConnectGoogleButton url={googleAuthUrl} label="Connect Google Calendar" />
          )}
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Subscription</h2>
          <p className="text-sm text-zinc-500 mb-4">$20/month · 250 SMS/month included</p>
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-xs px-2 py-0.5 rounded-full ${profile?.subscription_status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {profile?.subscription_status === 'active' ? 'Active' : 'Inactive'}
            </span>
            {profile?.stripe_customer_id && <ManageBillingButton />}
          </div>
          {profile?.subscription_status === 'active' && profile?.stripe_subscription_id && (
            <CancelSubscriptionButton />
          )}
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-1">Feedback</h2>
          <p className="text-xs text-zinc-600 mb-4">Report a bug, request a feature, or just share a thought. Goes straight to the team.</p>
          <FeedbackForm />
        </div>
      </div>

      <div className="mt-6 md:hidden">
        <SignOutButton />
      </div>
    </div>
  )
}
