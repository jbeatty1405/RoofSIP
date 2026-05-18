-- RoofSIP launch prep — run once in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ─── 1. MISSING COLUMNS ON EXISTING TABLES ──────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pm_phone TEXT,
  ADD COLUMN IF NOT EXISTS pm_email TEXT,
  ADD COLUMN IF NOT EXISTS message_style TEXT;

ALTER TABLE homeowners
  ADD COLUMN IF NOT EXISTS sms_paused_until TIMESTAMPTZ;

-- ─── 2. TABLES (all safe to re-run) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  auto_schedule BOOLEAN NOT NULL DEFAULT TRUE,
  working_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  working_hours_start TIME NOT NULL DEFAULT '09:00',
  working_hours_end TIME NOT NULL DEFAULT '17:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS markets_roofer_id_idx ON markets(roofer_id);
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own markets" ON markets;
CREATE POLICY "Users can manage own markets"
  ON markets FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

CREATE TABLE IF NOT EXISTS market_zips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  UNIQUE (market_id, zip_code)
);
CREATE INDEX IF NOT EXISTS market_zips_market_id_idx ON market_zips(market_id);
CREATE INDEX IF NOT EXISTS market_zips_zip_code_idx ON market_zips(zip_code);
ALTER TABLE market_zips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own market_zips" ON market_zips;
CREATE POLICY "Users can manage own market_zips"
  ON market_zips FOR ALL
  USING  (EXISTS (SELECT 1 FROM markets m WHERE m.id = market_zips.market_id AND m.roofer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM markets m WHERE m.id = market_zips.market_id AND m.roofer_id = auth.uid()));

CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roofer_id, market_id, blocked_date)
);
CREATE INDEX IF NOT EXISTS blocked_dates_roofer_id_idx ON blocked_dates(roofer_id);
CREATE INDEX IF NOT EXISTS blocked_dates_market_id_idx ON blocked_dates(market_id);
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own blocked_dates" ON blocked_dates;
CREATE POLICY "Users can manage own blocked_dates"
  ON blocked_dates FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  homeowner_id UUID REFERENCES homeowners(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_roofer_id_unread_idx ON notifications(roofer_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS notifications_roofer_id_created_idx ON notifications(roofer_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  storm_type TEXT NOT NULL DEFAULT 'Any storm',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sms_templates_roofer_id_idx ON sms_templates(roofer_id);
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sms_templates" ON sms_templates;
CREATE POLICY "Users can manage own sms_templates"
  ON sms_templates FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

CREATE TABLE IF NOT EXISTS pending_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_slot TIMESTAMPTZ,
  slots TIMESTAMPTZ[],
  status TEXT NOT NULL DEFAULT 'awaiting_ho_reply',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_bookings_homeowner_id_unique UNIQUE (homeowner_id)
);
CREATE INDEX IF NOT EXISTS pending_bookings_roofer_id_idx ON pending_bookings(roofer_id);
CREATE INDEX IF NOT EXISTS pending_bookings_status_idx ON pending_bookings(status);
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pending_bookings" ON pending_bookings;
DROP POLICY IF EXISTS "Service role can manage pending_bookings" ON pending_bookings;
CREATE POLICY "Users can manage own pending_bookings"
  ON pending_bookings FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);
CREATE POLICY "Service role can manage pending_bookings"
  ON pending_bookings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─── 3. RPC FUNCTIONS ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_sms_count(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET sms_count_this_month = sms_count_this_month + 1
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. VERIFY ───────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
