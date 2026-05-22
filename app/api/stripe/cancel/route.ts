import { createClient } from '@/app/_lib/supabase/server'
import { stripe } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, subscription_status')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
  }

  if (profile.subscription_status !== 'active') {
    return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
  }

  await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  return NextResponse.json({ ok: true })
}
