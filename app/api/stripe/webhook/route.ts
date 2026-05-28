import { createServiceClient } from '@/app/_lib/supabase/server'
import { stripe } from '@/app/_lib/stripe'
import { sendWelcomeEmail } from '@/app/_lib/email'
import type Stripe from 'stripe'
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
    const customerId = obj.customer as string | null
    if (userId && customerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, stripe_customer_id')
        .eq('id', userId)
        .single()

      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId)

      let ok = false
      if (profile && authUser?.email) {
        if (profile.stripe_customer_id && profile.stripe_customer_id === customerId) {
          ok = true
        } else if (!profile.stripe_customer_id) {
          const customer = await stripe.customers.retrieve(customerId)
          if (!customer.deleted && (customer as Stripe.Customer).email === authUser.email) {
            ok = true
          }
        }
      }

      if (ok) {
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: obj.subscription as string,
            subscription_status: 'active',
          })
          .eq('id', userId)
          .select('pm_name')
          .single()

        sendWelcomeEmail({
          to: authUser!.email!,
          pmName: updatedProfile?.pm_name ?? undefined,
        }).catch(err => console.error('[webhook] welcome email failed:', err))
      } else {
        console.error('Stripe webhook: customer/user mismatch', { userId, customerId })
      }
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
