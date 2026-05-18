import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { stripe, createCheckoutSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHECKOUT_RATE_LIMIT = 5 // per hour per user

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email first' }, { status: 403 })
  }

  const serviceClient = await createServiceClient()
  const { data: count, error: rlError } = await serviceClient.rpc('checkout_rate_limit', {
    p_user_id: user.id,
    p_limit: CHECKOUT_RATE_LIMIT,
  })
  if (rlError || (count as number) > CHECKOUT_RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const url = await createCheckoutSession(customerId, user.id)
  return NextResponse.json({ url })
}
