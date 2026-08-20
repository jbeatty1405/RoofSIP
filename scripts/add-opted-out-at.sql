-- Make "this homeowner told us to stop" a first-class fact.
--
-- Until now it was inferred: tcpa_consent = false AND (they had consented or
-- confirmed at some point). That heuristic is right for anyone who went through
-- the opt-in flow, but consent = false is ALSO the resting state of a CSV import
-- and of every monitor-only home — neither of which ever sets tcpa_consent_at.
-- So a monitor-only homeowner who texts STOP is correctly removed from every
-- alert path but cannot be told apart from one who simply never opted in, and
-- the app can't label them.
--
-- Safe to run more than once. Adds a nullable column and backfills; it does not
-- change anyone's consent, and it does not touch who does or doesn't get texted.
--
-- Run in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.

ALTER TABLE homeowners ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

COMMENT ON COLUMN homeowners.opted_out_at IS
  'When the homeowner withdrew consent by text (STOP). Cleared when they text START. '
  'tcpa_consent is what gates sending; this is the durable record of who asked us to stop.';

-- Backfill 1: anyone we can date from their own inbound STOP message.
UPDATE homeowners h
SET opted_out_at = s.stopped_at
FROM (
  SELECT homeowner_id, MAX(sent_at) AS stopped_at
  FROM sms_logs
  WHERE direction = 'inbound'
    AND regexp_replace(lower(message), '[^a-z ]', '', 'g') ~
        '(^ *(stop|stopall|unsubscribe|cancel|quit|end) *$|stop texting|stop messaging|take me off|remove me|do ?n.?t text|unsubscribe)'
  GROUP BY homeowner_id
) s
WHERE h.id = s.homeowner_id
  AND h.opted_out_at IS NULL
  AND h.tcpa_consent = false;

-- Backfill 2: the rest of the currently-inferred opt-outs, dated from the
-- consent they later withdrew. Matches exactly what the app displays today, so
-- running this changes no badge that is already correct.
UPDATE homeowners
SET opted_out_at = tcpa_consent_at
WHERE opted_out_at IS NULL
  AND tcpa_consent = false
  AND tcpa_consent_at IS NOT NULL;

-- What the app filters on.
CREATE INDEX IF NOT EXISTS homeowners_opted_out_at_idx
  ON homeowners (opted_out_at)
  WHERE opted_out_at IS NOT NULL;

-- Check: every row this reports should be someone who really did opt out.
SELECT id, name, phone, tcpa_consent, sms_confirmed, monitor_only, opted_out_at
FROM homeowners
WHERE opted_out_at IS NOT NULL
ORDER BY opted_out_at DESC;
