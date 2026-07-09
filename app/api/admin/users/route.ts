import { createClient } from '@/app/_lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { stripe } from '@/app/_lib/stripe'
import { NextResponse } from 'next/server'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

export const dynamic = 'force-dynamic'

// Rank Stripe statuses so a customer's *most relevant* subscription wins when
// they have more than one (e.g. an old canceled sub + a fresh trialing one).
const STATUS_RANK: Record<string, number> = {
  active: 6,
  trialing: 5,
  past_due: 4,
  unpaid: 3,
  incomplete: 2,
  paused: 1,
  canceled: 0,
  incomplete_expired: 0,
}

type StripeInfo = {
  status: string
  amount: number // monthly cents
  trialEnd: number | null // unix seconds
  periodEnd: number | null // unix seconds
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // True service-role client (no user cookie) so RLS is bypassed and we can read
  // every contractor's profile + the GoTrue admin API. The cookie-based
  // createServiceClient() would authorize as the logged-in admin and RLS would
  // scope the read to a single row.
  const service = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, ''),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const [{ data: profiles }, authList, homeownersRes, bookingsRes] = await Promise.all([
    service
      .from('profiles')
      .select('id, pm_name, company_name, pm_phone, pm_email, subscription_status, stripe_customer_id, stripe_subscription_id, sms_count_this_month, sms_cap, created_at')
      .order('created_at', { ascending: false }),
    service.auth.admin.listUsers(),
    service.from('homeowners').select('roofer_id, is_test'),
    service.from('bookings').select('roofer_id'),
  ])

  const emailMap = Object.fromEntries((authList.data?.users ?? []).map(u => [u.id, u.email]))

  // Engagement counts per roofer (exclude test homeowners).
  const homeownerCounts: Record<string, number> = {}
  for (const h of homeownersRes.data ?? []) {
    if (h.is_test) continue
    if (h.roofer_id) homeownerCounts[h.roofer_id] = (homeownerCounts[h.roofer_id] ?? 0) + 1
  }
  const bookingCounts: Record<string, number> = {}
  for (const b of bookingsRes.data ?? []) {
    if (b.roofer_id) bookingCounts[b.roofer_id] = (bookingCounts[b.roofer_id] ?? 0) + 1
  }

  // Pull real billing state from Stripe (one paginated call, ~few dozen subs).
  const stripeByCustomer: Record<string, StripeInfo> = {}
  try {
    let startingAfter: string | undefined
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await stripe.subscriptions.list({ status: 'all', limit: 100, starting_after: startingAfter })
      for (const s of page.data) {
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id
        if (!customerId) continue
        const item = s.items.data[0]
        const info: StripeInfo = {
          status: s.status,
          amount: item?.price?.unit_amount ?? 0,
          trialEnd: s.trial_end ?? null,
          // current_period_end moved onto items in recent API versions; read both.
          periodEnd: (s as { current_period_end?: number }).current_period_end
            ?? (item as { current_period_end?: number } | undefined)?.current_period_end
            ?? null,
        }
        const existing = stripeByCustomer[customerId]
        if (!existing || (STATUS_RANK[info.status] ?? 0) >= (STATUS_RANK[existing.status] ?? 0)) {
          stripeByCustomer[customerId] = info
        }
      }
      if (!page.has_more) break
      startingAfter = page.data[page.data.length - 1]?.id
    }
  } catch (err) {
    console.error('[admin/users] Stripe fetch failed:', err)
  }

  const result = (profiles ?? []).map(p => {
    const s = p.stripe_customer_id ? stripeByCustomer[p.stripe_customer_id] : undefined
    return {
      id: p.id,
      email: emailMap[p.id] ?? '—',
      pm_name: p.pm_name,
      company_name: p.company_name,
      pm_phone: p.pm_phone,
      pm_email: p.pm_email,
      subscription_status: p.subscription_status,
      created_at: p.created_at,
      sms_used: p.sms_count_this_month ?? 0,
      sms_cap: p.sms_cap ?? 0,
      homeowners: homeownerCounts[p.id] ?? 0,
      bookings: bookingCounts[p.id] ?? 0,
      stripe_status: s?.status ?? null,
      monthly_amount: s?.amount ?? null,
      trial_end: s?.trialEnd ?? null,
      period_end: s?.periodEnd ?? null,
    }
  })

  return NextResponse.json(result)
}
