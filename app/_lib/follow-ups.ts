// The storm follow-up window is 48h wide (48–96h after the alert) and the weather
// job runs hourly, so an unresponsive homeowner qualifies on ~48 consecutive runs.
// Without a dedupe every run inserts another identical call_needed: one lead
// produced 20 notifications for a PM over two days on 2026-08-12.
//
// A homeowner is "already told" only if a call_needed landed AFTER the alert being
// followed up on. Keying off the homeowner's own alert time rather than a flat
// window means a later storm can still raise a fresh follow-up for the same person.

export type FollowUpCandidate = { homeowner_id: string; alertTime: string }
export type PriorNotification = { homeowner_id: string; created_at: string }

export function alreadyNotifiedIds(
  candidates: FollowUpCandidate[],
  priorCallNeeded: PriorNotification[],
): Set<string> {
  const alertTimeById = new Map(candidates.map(c => [c.homeowner_id, c.alertTime]))
  const notified = new Set<string>()

  for (const n of priorCallNeeded) {
    const alertTime = alertTimeById.get(n.homeowner_id)
    if (alertTime && n.created_at > alertTime) notified.add(n.homeowner_id)
  }

  return notified
}
