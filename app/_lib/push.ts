// Expo push notifications — the BACKEND half of the pipe.
// The mobile app (roofsip-mobile/lib/notifications.ts) already registers the
// device and saves an Expo push token to profiles.push_token; this is what
// actually sends to it. No SDK — Expo's HTTP push API is a single POST.
//
// Tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
// Invalid/missing tokens are skipped silently so a bad token never throws in
// the SMS/booking pipeline.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  /**
   * iOS app-icon badge count. iOS only shows a number on the icon if the push
   * payload carries one — without this the app never gets a badge. Typically the
   * recipient's unread notification count. Omitted/undefined => no badge change.
   */
  badge?: number
}

function isExpoToken(t: unknown): t is string {
  return typeof t === 'string' && t.startsWith('ExponentPushToken')
}

/**
 * Fire one or more Expo push messages. Never throws — logs and moves on, so a
 * push failure can't break a storm-alert run or a booking confirmation.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  // Safety gate: the push CHANNEL stays dark until PUSH_ENABLED=true, so the
  // first real push to live PMs is a deliberate go-live (with a test first),
  // not a surprise on the next cron. In-app notifications are unaffected — only
  // the interruptive push is gated.
  if (process.env.PUSH_ENABLED !== 'true') return

  const valid = messages.filter((m) => isExpoToken(m.to))
  if (valid.length === 0) return

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        valid.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          data: m.data ?? {},
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          // Only include badge when the caller provided one, so pushes that
          // don't compute a count leave the existing badge untouched.
          ...(typeof m.badge === 'number' ? { badge: m.badge } : {}),
        }))
      ),
    })
    if (!res.ok) {
      console.error(`[push] Expo API ${res.status}: ${await res.text().catch(() => '')}`)
    }
  } catch (err) {
    console.error('[push] send failed:', err)
  }
}
