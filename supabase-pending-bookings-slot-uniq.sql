-- Applied to prod 2026-06-06 (project bzdkftdaclmrblyhoweo).
-- Guarantees no two ACTIVE bookings for the same roofer can hold the same time slot,
-- even across overlapping cron runs. Pairs with the reserve-before-send retry in
-- app/api/weather/route.ts and the taken-status list in app/_lib/markets.ts.
CREATE UNIQUE INDEX IF NOT EXISTS pending_bookings_active_slot_uniq
ON pending_bookings (roofer_id, proposed_slot)
WHERE status IN ('awaiting_ho_reply', 'confirmed') AND proposed_slot IS NOT NULL;
