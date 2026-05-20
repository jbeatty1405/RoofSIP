import { createClient } from '@/app/_lib/supabase/server'
import SubscribeBanner from './SubscribeBanner'
import Link from 'next/link'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { count: homeownerCount },
    { count: optedInCount },
    { count: marketsCount },
    { data: confirmedBookings },
    { data: callsNeeded },
    { count: callsTotal },
    { data: lastSms },
  ] = await Promise.all([
    supabase.from('profiles').select('pm_name, company_name, stripe_customer_id, subscription_status').eq('id', user!.id).single(),
    supabase.from('homeowners').select('*', { count: 'exact', head: true }).eq('roofer_id', user!.id),
    supabase.from('homeowners').select('*', { count: 'exact', head: true }).eq('roofer_id', user!.id).eq('tcpa_consent', true),
    supabase.from('markets').select('*', { count: 'exact', head: true }).eq('roofer_id', user!.id),
    supabase.from('pending_bookings').select('id, proposed_slot, homeowners(name, phone, address)').eq('roofer_id', user!.id).eq('status', 'confirmed').gt('proposed_slot', new Date().toISOString()).order('proposed_slot', { ascending: true }).limit(10),
    supabase.from('notifications').select('id, message, type, created_at, homeowners(name, phone, address)').eq('roofer_id', user!.id).eq('read', false).neq('type', 'hot_lead').order('created_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('roofer_id', user!.id).eq('read', false).neq('type', 'hot_lead'),
    supabase.from('sms_logs').select('created_at').eq('roofer_id', user!.id).eq('direction', 'outbound').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const isTrial = profile?.subscription_status !== 'active'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  let lastAlertLabel = 'No alerts sent yet'
  if (lastSms?.created_at) {
    const days = Math.floor((Date.now() - new Date(lastSms.created_at).getTime()) / 86400000)
    lastAlertLabel = days === 0 ? 'Last alert today' : days === 1 ? 'Last alert yesterday' : `Last alert ${days}d ago`
  }

  const hasActivity = (confirmedBookings?.length ?? 0) > 0 || (callsNeeded?.length ?? 0) > 0

  return (
    <div>
      {isTrial && <SubscribeBanner />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting}{profile?.pm_name ? `, ${profile.pm_name}` : ''}
          </h1>
          {profile?.company_name && <p className="text-zinc-500 text-sm mt-1">{profile.company_name}</p>}
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400" />
          </span>
          <span className="text-xs text-zinc-400">Hailey active</span>
          <span className="text-zinc-700 text-xs">·</span>
          <span className="text-xs text-zinc-500">{lastAlertLabel}</span>
        </div>
      </div>

      {/* Confirmed Appointments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider">Confirmed appointments</h2>
          </div>
          {(confirmedBookings?.length ?? 0) > 0 && (
            <span className="text-xs text-zinc-600">{confirmedBookings!.length} upcoming</span>
          )}
        </div>

        {(confirmedBookings?.length ?? 0) === 0 ? (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-600">No confirmed appointments yet</p>
            <p className="text-xs text-zinc-700 mt-1">Confirmed times from homeowners will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {confirmedBookings!.map((b: any) => {
              const slot = new Date(b.proposed_slot)
              const dateStr = slot.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
              const timeStr = slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return (
                <div key={b.id} className="bg-zinc-900 rounded-xl border border-green-500/30 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-2">
                        <p className="text-xl font-bold text-white">{timeStr}</p>
                        <p className="text-sm text-zinc-400">{dateStr}</p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">{b.homeowners?.name}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{b.homeowners?.address}</p>
                    </div>
                    <a
                      href={`tel:${b.homeowners?.phone}`}
                      className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      Call
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Calls Needed */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Calls needed</h2>
          </div>
          {(callsTotal ?? 0) > 0 && (
            <Link href="/notifications" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              View all {callsTotal} →
            </Link>
          )}
        </div>

        {(callsNeeded?.length ?? 0) === 0 ? (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-600">No calls needed</p>
            <p className="text-xs text-zinc-700 mt-1">Homeowners who need a call to set an appointment show up here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {callsNeeded!.map((n: any) => (
              <div key={n.id} className="bg-zinc-900 rounded-xl border border-amber-500/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-200">{n.homeowners?.name}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{n.homeowners?.address}</p>
                    <p className="text-sm text-zinc-400 mt-2">{n.message}</p>
                  </div>
                  <a
                    href={`tel:${n.homeowners?.phone}`}
                    className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Call
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All clear state */}
      {!hasActivity && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-10 text-center mb-8">
          <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-zinc-300 font-semibold text-sm">All clear</p>
          <p className="text-zinc-600 text-xs mt-1">Hailey is monitoring. You'll see appointments and call requests here as they come in.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/homeowners" className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-sky-800 transition-all group">
          <p className="text-xs text-zinc-500 mb-2">Homeowners</p>
          <p className="text-3xl font-bold text-white">{homeownerCount ?? 0}</p>
          <p className="text-xs text-zinc-600 mt-1">{optedInCount ?? 0} opted in</p>
        </Link>

        <Link href="/markets" className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-sky-800 transition-all group">
          <p className="text-xs text-zinc-500 mb-2">Markets</p>
          <p className="text-3xl font-bold text-white">{marketsCount ?? 0}</p>
          <p className="text-xs text-zinc-600 mt-1">{marketsCount ? 'active' : 'none set up'}</p>
        </Link>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-2">Opt-in rate</p>
          <p className="text-3xl font-bold text-white">
            {homeownerCount ? `${Math.round(((optedInCount ?? 0) / homeownerCount) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">{optedInCount ?? 0} of {homeownerCount ?? 0}</p>
        </div>
      </div>
    </div>
  )
}
