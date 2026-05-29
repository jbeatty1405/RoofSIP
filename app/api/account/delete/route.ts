import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { stripe } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Permanently deletes the signed-in user's account.
// Required by App Store Review Guideline 5.1.1(v): any app that supports
// account creation must offer in-app account deletion.
// Auth: cookie session, or Bearer access token (mobile app) — same pattern as stripe/portal.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const authHeader = request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  // Cancel any active Stripe subscription so a deleted user is never billed again.
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id)
    } catch {
      // Already canceled / not found — safe to proceed with deletion.
    }
  }

  // Delete the auth user. ON DELETE CASCADE on profiles(id)->auth.users and every
  // roofer_id->profiles FK removes profiles, homeowners, markets, notifications,
  // pending_bookings, sms_logs and bookings in one shot.
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: 'Could not delete account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
