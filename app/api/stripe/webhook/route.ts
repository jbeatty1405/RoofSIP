import { createServiceClient } from '@/app/_lib/supabase/server'
import { stripe } from '@/app/_lib/stripe'
import { sendWelcomeEmail, sendTrialEndingEmail } from '@/app/_lib/email'
import { ADMIN_USER_ID, notifyAdmin, claimOnce, describePm, logBillingEvent } from '@/app/_lib/admin'
import { notifyRoofer } from '@/app/_lib/notify'
import type Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Stripe subscription statuses that still entitle the customer to the product.
// `past_due` is deliberately included: Stripe is mid-retry and the customer has
// not churned yet. Access ends at `unpaid`/`canceled`, i.e. once retries are done.
const ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due'])

function hasAccess(status: string | null | undefined): boolean {
  return ACCESS_STATUSES.has(status ?? '')
}

// Billing health, tracked separately from access so a declined card is visible
// without silently switching the product off.
function billingStateFor(status: string | null | undefined): 'active' | 'past_due' | 'canceled' {
  if (status === 'past_due' || status === 'incomplete') return 'past_due'
  if (status === 'unpaid' || status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'active'
}

// Newer Stripe API versions moved the subscription off the invoice root and into
// `parent.subscription_details`. Reading only `invoice.subscription` wrote NULL
// subscription ids into the billing ledger.
function invoiceSubscriptionId(obj: any): string | null {
  return (obj.subscription ?? obj.parent?.subscription_details?.subscription ?? null) as string | null
}

// Best-effort identity for the billing ledger + alerts. Resolves the PM behind a
// subscription/customer at event time, so a later profile deletion can't erase
// who the event belonged to. Returns nulls (never throws) if no profile matches.
async function resolveSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ids: { subscriptionId?: string | null; customerId?: string | null },
) {
  try {
    let profile: { id: string; pm_name: string | null; company_name: string | null; stripe_customer_id: string | null } | null = null
    if (ids.subscriptionId) {
      profile = (await supabase
        .from('profiles')
        .select('id, pm_name, company_name, stripe_customer_id')
        .eq('stripe_subscription_id', ids.subscriptionId)
        .maybeSingle()).data
    }
    if (!profile && ids.customerId) {
      profile = (await supabase
        .from('profiles')
        .select('id, pm_name, company_name, stripe_customer_id')
        .eq('stripe_customer_id', ids.customerId)
        .maybeSingle()).data
    }
    let email: string | null = null
    if (profile) {
      const { data } = await supabase.auth.admin.getUserById(profile.id)
      email = data?.user?.email ?? null
    }
    return {
      userId: profile?.id ?? null,
      email,
      pmName: profile?.pm_name ?? null,
      companyName: profile?.company_name ?? null,
      customerId: ids.customerId ?? profile?.stripe_customer_id ?? null,
    }
  } catch (err) {
    console.error('[webhook] resolveSnapshot failed:', err)
    return { userId: null, email: null, pmName: null, companyName: null, customerId: ids.customerId ?? null }
  }
}

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
          .select('pm_name, company_name')
          .single()

        sendWelcomeEmail({
          to: authUser!.email!,
          pmName: updatedProfile?.pm_name ?? undefined,
        }).catch(err => console.error('[webhook] welcome email failed:', err))

        await logBillingEvent(supabase, {
          eventType: 'created',
          stripeEventId: event.id,
          customerId,
          subscriptionId: obj.subscription as string,
          subStatus: 'trialing',
          userId,
          email: authUser!.email!,
          pmName: updatedProfile?.pm_name,
          companyName: updatedProfile?.company_name,
        })

        // Owner alert: they handed over a card, so this is the real signup moment.
        // Skipped when the admin subscribes himself (no self-alerts).
        if (userId !== ADMIN_USER_ID) {
          const who = describePm(updatedProfile?.pm_name, updatedProfile?.company_name)
          await notifyAdmin(supabase, {
            title: '🎉 New RoofSIP subscriber',
            message: `${who} just signed up. Card on file, 60-day trial started.`,
            data: { event: 'signup', userId, email: authUser!.email! },
          })
        }
      } else {
        console.error('Stripe webhook: customer/user mismatch', { userId, customerId })
      }
    }
  }

  // Free-trial-ending reminder (CA ARL / ROSCA compliance). Stripe fires this ~3 days
  // before a trial converts to a paid subscription.
  if (event.type === 'customer.subscription.trial_will_end') {
    const subId = obj.id as string
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, pm_name')
      .eq('stripe_subscription_id', subId)
      .maybeSingle()

    if (profile) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id)
      if (authUser?.email) {
        const trialEndDate = obj.trial_end
          ? new Date(obj.trial_end * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          : 'soon'
        sendTrialEndingEmail({
          to: authUser.email,
          pmName: profile.pm_name ?? undefined,
          trialEndDate,
        }).catch(err => console.error('[webhook] trial-ending email failed:', err))
      }
    } else {
      console.error('[webhook] trial_will_end: no profile for subscription', subId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    // `past_due` means Stripe is still retrying the card (Smart Retries: 8 attempts
    // over 2 weeks). Keeping access through that window is the whole point — cutting
    // service on the first decline killed storm monitoring for a paying customer.
    // Access only ends when Stripe actually gives up, which arrives as
    // `subscription.deleted` / `unpaid` and is handled below.
    await supabase
      .from('profiles')
      .update({
        subscription_status: hasAccess(obj.status) ? 'active' : 'inactive',
        billing_state: billingStateFor(obj.status),
      })
      .eq('stripe_subscription_id', obj.id)

    const snap = await resolveSnapshot(supabase, { subscriptionId: obj.id, customerId: obj.customer })
    await logBillingEvent(supabase, {
      eventType: 'updated',
      stripeEventId: event.id,
      subscriptionId: obj.id,
      subStatus: obj.status,
      amountCents: obj.items?.data?.[0]?.price?.unit_amount ?? null,
      ...snap,
    })
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    // Snapshot BEFORE we touch the profile — the PM (and later the whole row) may
    // vanish, and this ledger row is the only permanent record of the churn.
    const snap = await resolveSnapshot(supabase, { subscriptionId: obj.id, customerId: obj.customer })

    await supabase
      .from('profiles')
      .update({ subscription_status: 'inactive', billing_state: 'canceled' })
      .eq('stripe_subscription_id', obj.id)

    const isCancel = event.type === 'customer.subscription.deleted'
    await logBillingEvent(supabase, {
      eventType: isCancel ? 'canceled' : 'paused',
      stripeEventId: event.id,
      subscriptionId: obj.id,
      subStatus: obj.status,
      amountCents: obj.items?.data?.[0]?.price?.unit_amount ?? null,
      ...snap,
    })

    // Owner alert: a subscriber left. Never self-alert on the admin's own sub.
    if (isCancel && snap.userId !== ADMIN_USER_ID) {
      const who = describePm(snap.pmName, snap.companyName)
      await notifyAdmin(supabase, {
        title: '❌ Subscriber cancelled',
        message: `${who} cancelled their RoofSIP subscription.`,
        data: { event: 'canceled', userId: snap.userId, subId: obj.id, email: snap.email },
      })
    }
  }

  if (event.type === 'customer.subscription.resumed' || event.type === 'invoice.payment_succeeded') {
    const subId = event.type === 'invoice.payment_succeeded'
      ? invoiceSubscriptionId(obj)
      : obj.id
    if (subId) {
      // A successful charge clears any past_due flag — the card went through.
      await supabase
        .from('profiles')
        .update({ subscription_status: 'active', billing_state: 'active' })
        .eq('stripe_subscription_id', subId)
    }

    if (subId) {
      const isInvoice = event.type === 'invoice.payment_succeeded'
      const snap = await resolveSnapshot(supabase, { subscriptionId: subId, customerId: obj.customer })
      await logBillingEvent(supabase, {
        eventType: isInvoice ? 'payment_succeeded' : 'resumed',
        stripeEventId: event.id,
        subscriptionId: subId,
        subStatus: isInvoice ? 'active' : obj.status,
        amountCents: isInvoice ? (obj.amount_paid ?? null) : (obj.items?.data?.[0]?.price?.unit_amount ?? null),
        ...snap,
      })
    }

    // Owner alert: real money actually moved (trial invoices are $0, so they're
    // skipped). This event repeats every billing cycle, so `claimOnce` pins the
    // alert to the FIRST paid invoice only — the trial-to-paid conversion.
    if (event.type === 'invoice.payment_succeeded' && subId && (obj.amount_paid ?? 0) > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, pm_name, company_name')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()

      if (profile && profile.id !== ADMIN_USER_ID) {
        const first = await claimOnce(
          supabase,
          `first_payment:${subId}`,
          `first paid invoice for ${profile.id}`,
        )
        if (first) {
          const who = describePm(profile.pm_name, profile.company_name)
          const amount = (obj.amount_paid / 100).toFixed(2)
          await notifyAdmin(supabase, {
            title: '💰 Trial converted',
            message: `${who} just paid $${amount}. First real payment — they stuck.`,
            data: { event: 'first_payment', userId: profile.id, subId },
          })
        }
      }
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const subId = invoiceSubscriptionId(obj)

    // Flag the billing trouble WITHOUT touching access. Stripe keeps retrying and
    // the customer keeps working; this is what the dashboard banner reads.
    if (subId) {
      await supabase
        .from('profiles')
        .update({ billing_state: 'past_due' })
        .eq('stripe_subscription_id', subId)
    }

    const snap = await resolveSnapshot(supabase, { subscriptionId: subId, customerId: obj.customer })
    await logBillingEvent(supabase, {
      eventType: 'payment_failed',
      stripeEventId: event.id,
      subscriptionId: subId,
      subStatus: 'past_due',
      amountCents: obj.amount_due ?? null,
      ...snap,
    })

    // Tell the CUSTOMER, in-app + push. Nothing about their service changes for the
    // full 14-day retry window, so this notice is the only thing prompting them to
    // fix the card before it runs out. Fires once per Stripe retry attempt, which
    // spaces itself out (8 attempts across 2 weeks) rather than spamming.
    if (snap.userId) {
      try {
        await notifyRoofer(supabase, {
          roofer_id: snap.userId,
          type: 'billing',
          // Reason-neutral on purpose. The most common decline is insufficient
          // funds, where the card is perfectly good and telling someone to
          // "update your card" sends them to fix something that isn't broken.
          pushTitle: '💳 Payment didn\'t go through',
          message: 'Your $20 payment didn\'t go through. Nothing has been switched off and your homeowners are still monitored. We\'ll keep retrying over the next two weeks, so it clears on its own once funds are available. You can also swap the card in Settings.',
          pushBody: 'Your $20 payment didn\'t go through. Nothing is switched off. We\'ll keep retrying.',
          data: { event: 'payment_failed', subId },
        })
      } catch (err) {
        // Never let a notification failure break the webhook and make Stripe retry.
        console.error('[webhook] payment_failed customer notice failed:', err)
      }
    }

    // Owner alert: money at risk. Not deduped — Stripe only fires this on genuine
    // retry attempts, and each failed attempt is worth knowing about.
    if (snap.userId !== ADMIN_USER_ID) {
      const who = describePm(snap.pmName, snap.companyName)
      const amount = ((obj.amount_due ?? 0) / 100).toFixed(2)
      await notifyAdmin(supabase, {
        title: '⚠️ Payment failed',
        message: `${who}'s payment of $${amount} failed. At risk of churning.`,
        data: { event: 'payment_failed', userId: snap.userId, subId, email: snap.email },
      })
    }
  }

  return NextResponse.json({ received: true })
}
