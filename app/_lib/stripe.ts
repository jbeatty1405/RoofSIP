import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder')

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? ''

export const TRIAL_DAYS = 60

// The 60 free days are a first-time offer. Without this check, cancelling and
// re-subscribing granted another full trial every time — farmable forever, and the
// "Restart subscription" button on /subscribe leads straight to it.
export async function hasHadTrial(customerId: string): Promise<boolean> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return subs.data.some(s => s.trial_start != null)
}

export async function createCheckoutSession(customerId: string, userId: string, appUrl: string): Promise<string> {
  const usedTrial = await hasHadTrial(customerId)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    ...(usedTrial ? {} : { subscription_data: { trial_period_days: TRIAL_DAYS } }),
    // Auto-renewal disclosure shown on Stripe's hosted payment page (CA ARL / ROSCA).
    // Must describe what this customer actually gets, so returning customers are told
    // they're billed today rather than promised a trial they won't receive.
    custom_text: {
      submit: {
        message: usedTrial
          ? 'Your card is charged $20 today and renews monthly until you cancel. Cancel anytime in Settings.'
          : `Your ${TRIAL_DAYS}-day free trial starts today — no charge now. After the trial, your card is automatically charged $20/month and renews monthly until you cancel. Cancel anytime in Settings.`,
      },
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
