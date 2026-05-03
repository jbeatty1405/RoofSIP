-- Run this in Supabase SQL Editor.
-- Audit-driven RLS policies for tables that exist in the live database but
-- are not covered by supabase-schema.sql. Without these policies, an attacker
-- with the anon key (which is in the bundled client) can read/write any tenant's data.

-- pending_bookings ----------------------------------------------------------
ALTER TABLE pending_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own pending_bookings" ON pending_bookings;
DROP POLICY IF EXISTS "Service role can manage pending_bookings" ON pending_bookings;
CREATE POLICY "Users can view own pending_bookings"
  ON pending_bookings FOR SELECT USING (auth.uid() = roofer_id);
CREATE POLICY "Service role can manage pending_bookings"
  ON pending_bookings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- notifications -------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- markets -------------------------------------------------------------------
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own markets" ON markets;
CREATE POLICY "Users can manage own markets"
  ON markets FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

-- market_zips ---------------------------------------------------------------
-- Tenant scope is via markets.roofer_id; join through markets.
ALTER TABLE market_zips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own market_zips" ON market_zips;
CREATE POLICY "Users can manage own market_zips"
  ON market_zips FOR ALL
  USING (EXISTS (SELECT 1 FROM markets m WHERE m.id = market_zips.market_id AND m.roofer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM markets m WHERE m.id = market_zips.market_id AND m.roofer_id = auth.uid()));

-- blocked_dates -------------------------------------------------------------
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own blocked_dates" ON blocked_dates;
CREATE POLICY "Users can manage own blocked_dates"
  ON blocked_dates FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

-- sms_templates -------------------------------------------------------------
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sms_templates" ON sms_templates;
CREATE POLICY "Users can manage own sms_templates"
  ON sms_templates FOR ALL USING (auth.uid() = roofer_id) WITH CHECK (auth.uid() = roofer_id);

-- weather_events (global, but should be readable by all auth'd users only) --
ALTER TABLE weather_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read weather_events" ON weather_events;
DROP POLICY IF EXISTS "Service role can insert weather_events" ON weather_events;
CREATE POLICY "Authenticated users can read weather_events"
  ON weather_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can insert weather_events"
  ON weather_events FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- homeowner-photos storage bucket ------------------------------------------
-- If you have a storage bucket called "homeowner-photos", make sure it is set
-- to "private" in Dashboard > Storage, and add policies in Storage > Policies.
-- Recommended: only allow auth.uid() to read/write their own folder.

-- Verify after running:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- All should show rowsecurity = true.
