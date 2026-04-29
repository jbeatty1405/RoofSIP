import { createServiceClient } from '@/app/_lib/supabase/server'
import { stripe } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const obj = event.data.object as any

  if (event.type === 'checkout.session.completed') {
    const userId = obj.metadata?.userId
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          stripe_customer_id: obj.customer as string,
          stripe_subscription_id: obj.subscription as string,
          subscription_status: 'active',
        })
        .eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const isActive = obj.status === 'active' || obj.status === 'trialing'
    await supabase
      .from('profiles')
      .update({ subscription_status: isActive ? 'active' : 'inactive' })
      .eq('stripe_subscription_id', obj.id)
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    await supabase
      .from('profiles')
      .update({ subscription_status: 'inactive' })
      .eq('stripe_subscription_id', obj.id)
  }

  if (event.type === 'customer.subscription.resumed' || event.type === 'invoice.payment_succeeded') {
    const subId = obj.subscription ?? obj.id
    if (subId) {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'active' })
        .eq('stripe_subscription_id', subId)
    }
  }

  return NextResponse.json({ received: true })
}
