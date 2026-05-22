-- Migration: add missing columns + pending_bookings table
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
-- Run in Supabase SQL Editor

-- 1. profiles: pm contact info
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pm_phone TEXT,
  ADD COLUMN IF NOT EXISTS pm_email TEXT;

-- 2. homeowners: pause SMS after a no
ALTER TABLE homeowners
  ADD COLUMN IF NOT EXISTS sms_paused_until TIMESTAMPTZ;

-- 3. pending_bookings: tracks homeowner → PM confirmation loop
CREATE TABLE IF NOT EXISTS pending_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  roofer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'awaiting_ho_reply',
  proposed_slot TIMESTAMPTZ,
  slots        TIMESTAMPTZ[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homeowner_id)
);

CREATE INDEX IF NOT EXISTS pending_bookings_roofer_id_idx ON pending_bookings(roofer_id);
CREATE INDEX IF NOT EXISTS pending_bookings_homeowner_id_idx ON pending_bookings(homeowner_id);

ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pending_bookings" ON pending_bookings;
CREATE POLICY "Users can manage own pending_bookings"
  ON pending_bookings FOR ALL
  USING (auth.uid() = roofer_id)
  WITH CHECK (auth.uid() = roofer_id);

DROP POLICY IF EXISTS "Service role can manage pending_bookings" ON pending_bookings;
CREATE POLICY "Service role can manage pending_bookings"
  ON pending_bookings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify
SELECT 'profiles.pm_phone' AS col, COUNT(*) > 0 AS exists
  FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'pm_phone'
UNION ALL
SELECT 'profiles.pm_email', COUNT(*) > 0
  FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'pm_email'
UNION ALL
SELECT 'homeowners.sms_paused_until', COUNT(*) > 0
  FROM information_schema.columns
  WHERE table_name = 'homeowners' AND column_name = 'sms_paused_until'
UNION ALL
SELECT 'pending_bookings table', COUNT(*) > 0
  FROM information_schema.tables
  WHERE table_name = 'pending_bookings';
