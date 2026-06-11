import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { stripe, createCheckoutSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHECKOUT_RATE_LIMIT = 5 // per hour per user

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const { data: count, error: rlError } = await serviceClient.rpc('checkout_rate_limit', {
    p_user_id: user.id,
    p_limit: CHECKOUT_RATE_LIMIT,
  })
  if (rlError) {
    console.error('[checkout] rate limit RPC error:', rlError)
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
    // Use the service client: the cookie-auth client's column-scoped grant on
    // profiles excludes stripe_customer_id, so this write would silently 42501
    // and leave an orphan Stripe customer on every first checkout.
    await serviceClient
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const appUrl = new URL(request.url).origin
  const url = await createCheckoutSession(customerId, user.id, appUrl)
  return NextResponse.json({ url })
}
