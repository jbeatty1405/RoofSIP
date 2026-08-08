import { createClient, createAdminClient } from '@/app/_lib/supabase/server'
import { stripe, createCheckoutSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHECKOUT_RATE_LIMIT = 5 // per hour per user

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cookie-free on purpose. createServiceClient() carries the signed-in user's
  // session, which overrides the service key, so this RPC came back
  // "permission denied for function checkout_rate_limit" on every call from
  // 2026-06-17 onward. The guard below is written to skip on error, so the
  // rate limit was not merely broken, it was disabled — checkout ran unlimited
  // for seven weeks. The user is already authenticated above; this client is
  // only here for the privilege, not for identity.
  const adminClient = createAdminClient()
  const { data: count, error: rlError } = await adminClient.rpc('checkout_rate_limit', {
    p_user_id: user.id,
    p_limit: CHECKOUT_RATE_LIMIT,
  })
  if (rlError) {
    // Still fail open: blocking every checkout because a rate limiter broke
    // would cost real signups, and this guard exists for abuse, not billing.
    // But make it impossible to miss next time.
    console.error('[checkout] RATE LIMIT DISABLED — RPC failed, checkout is unthrottled:', rlError)
  }
  if (!rlError && (count as number) > CHECKOUT_RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (customerId) {
    // Block duplicate subscriptions. Without this, an already-subscribed user who
    // re-hits checkout (stale /subscribe tab, back button, double-click) creates a
    // SECOND $20/mo sub on the same customer; the webhook then overwrites
    // stripe_subscription_id, orphaning the original so it keeps billing forever
    // and cancel only stops the newest. Stripe is the source of truth here — our
    // subscription_status can lag the webhook.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
    const liveStatuses = ['active', 'trialing', 'past_due', 'unpaid']
    if (existing.data.some(s => liveStatuses.includes(s.status))) {
      return NextResponse.json({ error: 'You already have an active subscription.' }, { status: 400 })
    }
  } else {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    // The column-scoped grant on profiles excludes stripe_customer_id, so this
    // write 42501s as the signed-in user and leaves an orphan Stripe customer.
    // It was already reaching for a "service" client to avoid exactly that —
    // but createServiceClient() carries the user's cookies, so it WAS the
    // signed-in user and the write has been failing silently since the grants
    // were tightened. Verified 2026-08-07: as authenticated this PATCH returns
    // 403 42501, as service_role it succeeds. Must be the cookie-free client.
    const { error: custErr } = await adminClient
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)

    // Never swallow this again. A dropped write here means the duplicate
    // subscription guard above can't run on the next checkout, because it only
    // fires when a customer id was persisted.
    if (custErr) {
      console.error('[checkout] FAILED to persist stripe_customer_id — duplicate-subscription guard is now blind for this user:', custErr)
    }
  }

  const appUrl = new URL(request.url).origin
  const url = await createCheckoutSession(customerId, user.id, appUrl)
  return NextResponse.json({ url })
}
