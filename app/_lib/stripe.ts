import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder')

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? ''

export async function createCheckoutSession(customerId: string, userId: string, appUrl: string): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: 60,
    },
    success_url: `${appUrl}/subscribe?success=true`,
    cancel_url: `${appUrl}/subscribe`,
    metadata: { userId },
  })
  return session.url!
}

export async function createPortalSession(customerId: string, appUrl: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings`,
  })
  return session.url
}
