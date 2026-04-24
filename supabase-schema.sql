-- Run this in Supabase: Dashboard > SQL Editor

-- Profiles (one per roofer account, linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pm_name TEXT NOT NULL DEFAULT '',
  company_name TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_calendar_id TEXT,
  sms_count_this_month INT NOT NULL DEFAULT 0,
  sms_cap INT NOT NULL DEFAULT 250,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup using data from auth.users metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, pm_name, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'pm_name', ''),
    NEW.raw_user_meta_data->>'company_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Reset SMS count on the 1st of each month
CREATE OR REPLACE FUNCTION reset_monthly_sms_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET sms_count_this_month = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Homeowners
CREATE TABLE homeowners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  tcpa_consent BOOLEAN NOT NULL DEFAULT FALSE,
  tcpa_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weather events log
CREATE TABLE weather_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SMS logs (both inbound and outbound)
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  weather_event_id UUID REFERENCES weather_events(id),
  message TEXT NOT NULL,
  twilio_sid TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspection bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roofer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  homeowner_id UUID NOT NULL REFERENCES homeowners(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  google_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: roofers can only see their own data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowners ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own homeowners"
  ON homeowners FOR ALL USING (auth.uid() = roofer_id);

CREATE POLICY "Users can view own sms_logs"
  ON sms_logs FOR SELECT USING (auth.uid() = roofer_id);

CREATE POLICY "Service role can insert sms_logs"
  ON sms_logs FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT USING (auth.uid() = roofer_id);

CREATE POLICY "Service role can insert bookings"
  ON bookings FOR INSERT WITH CHECK (TRUE);
