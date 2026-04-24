import { createClient } from '@/app/_lib/supabase/server'
import { stripe, createCheckoutSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, stripeCustomerId } = await request.json()

  let customerId = stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email! })
    customerId = customer.id
  }

  const url = await createCheckoutSession(customerId, userId)
  return NextResponse.json({ url })
}
