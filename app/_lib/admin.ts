// Justin's Supabase user id — the single admin. Mirrors the constant used in
// app/admin/page.tsx; centralized here so the import endpoints can authorize
// "import on behalf of a roofer" without re-hardcoding it.
export const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

// Owner-facing alerts. These go to Justin's own device (he's a normal PM row in
// `profiles`, so the existing notify/push path works unchanged) and are stored
// with type 'admin_alert' — deliberately NOT 'hot_lead', so they never pollute
// the mobile hot-leads count or list.

import { notifyRoofer } from './notify'

type DbClient = { from: (table: string) => any }

/**
 * Push + persist an owner alert. Never throws: a failed alert must not take down
 * the Stripe webhook and cause Stripe to retry a payment event.
 */
export async function notifyAdmin(
  supabase: DbClient,
  args: { title: string; message: string; data?: Record<string, unknown> },
): Promise<void> {
  try {
    await notifyRoofer(supabase, {
      roofer_id: ADMIN_USER_ID,
      type: 'admin_alert',
      pushTitle: args.title,
      message: args.message,
      data: args.data,
    })
  } catch (err) {
    console.error('[admin-alert] failed:', err)
  }
}

/**
 * Claim a one-shot flag in `app_flags` (PK on `flag`). Returns true only for the
 * caller that wins the insert; a duplicate-key violation means someone already
 * claimed it. Used so a recurring Stripe event (invoice.payment_succeeded fires
 * every month) can trigger an alert exactly once.
 */
export async function claimOnce(supabase: DbClient, flag: string, note: string): Promise<boolean> {
  const { error } = await supabase.from('app_flags').insert({ flag, enabled: true, note })
  if (!error) return true
  if ((error as { code?: string }).code === '23505') return false
  console.error('[admin-alert] claimOnce failed:', error)
  return false
}

/** "Bob Smith (Bob's Roofing)" — falls back cleanly when either field is empty. */
export function describePm(pmName?: string | null, companyName?: string | null): string {
  const pm = pmName?.trim()
  const company = companyName?.trim()
  if (pm && company) return `${pm} (${company})`
  return pm || company || 'Someone'
}
