// notifyRoofer — single choke point for telling a PM something happened.
// Inserts the in-app notification row (what the app already reads) AND fires a
// push to that PM's device. Existing call sites that did a bare
// `notifications.insert(...)` are routed through here so they gain a push with
// no change to how the app queries notifications.
//
// `type` defaults to 'hot_lead' — a homeowner the PM should call. The mobile
// hot-leads list and dashboard count filter on `type = 'hot_lead'`, so anything
// that is NOT a call-this-person lead must pass an explicit type, or it inflates
// the PM's call list. Current types: hot_lead, call_needed, booking_confirmed
// (a won appointment), admin_alert (owner-only, not a lead).
//
// Both apps read "calls needed" as an allowlist rather than "not a hot lead", so
// adding a new type here is safe — it won't silently land in the call list — but
// the apps won't render it specially until they're taught about it.

import { sendExpoPush } from './push'

// Structural client type so this works with both the @supabase/supabase-js and
// @supabase/ssr clients used across the routes.
type DbClient = { from: (table: string) => any }

export type NotifyArgs = {
  roofer_id: string
  homeowner_id?: string | null
  /** In-app notification body (what shows in the app list). */
  message: string
  /** Push banner title — use the per-situation emoji/label (📅 / ⛈️ / 📲 / 📞). */
  pushTitle: string
  /** Optional separate, shorter push body. Defaults to `message`. */
  pushBody?: string
  /** Stored notification.type. Defaults to 'hot_lead' for app compatibility. */
  type?: string
  /** Extra data delivered with the push (for future deep-linking). */
  data?: Record<string, unknown>
}

export async function notifyRoofer(supabase: DbClient, args: NotifyArgs): Promise<void> {
  const type = args.type ?? 'hot_lead'

  // 1) Persist the in-app notification (unchanged shape the app already reads).
  await supabase.from('notifications').insert({
    roofer_id: args.roofer_id,
    homeowner_id: args.homeowner_id ?? null,
    type,
    message: args.message,
  })

  // 2) Push to the PM's device if one is registered.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', args.roofer_id)
      .single()

    if (profile?.push_token) {
      await sendExpoPush([
        {
          to: profile.push_token,
          title: args.pushTitle,
          body: args.pushBody ?? args.message,
          data: { type, homeowner_id: args.homeowner_id ?? null, ...(args.data ?? {}) },
        },
      ])
    }
  } catch (err) {
    // A push lookup/send failure must never break the caller (storm run, webhook).
    console.error('[notify] push step failed:', err)
  }
}
