-- Fix: mobile app (authenticated role, anon key + user JWT) got HTTP 403
-- "permission denied for table" (Postgres 42501) on notifications + bookings.
-- RLS policies already exist (scoped to auth.uid() = roofer_id) but the tables
-- were created via raw SQL without a table-level GRANT to `authenticated`, so
-- PostgREST denied access. The web app was unaffected because its API routes
-- use the service-role key (bypasses grants). homeowners/markets/profiles work
-- because they already carry the grant.
--
-- Safe: RLS still restricts rows to the owner; this only lets the role reach the
-- table at all. Idempotent. Apply in Supabase SQL editor.

-- Mobile reads notifications and marks them read (read = true) -> SELECT + UPDATE
grant select, update on public.notifications to authenticated;

-- Mobile reads bookings (id, status) only -> SELECT
grant select on public.bookings to authenticated;

-- 2026-06-03 round 2: exhaustive sweep of every table the mobile app reads
-- (.from(...) in app/) found two more with the same missing grant. Both are
-- read-only in the app (Home screen + homeowner detail + calendar). RLS already
-- scopes them to auth.uid() = roofer_id.
grant select on public.pending_bookings to authenticated;
grant select on public.sms_logs to authenticated;

-- 2026-06-03 round 3 (adversarial pass): the app WRITES too, not just reads.
-- homeowners + markets already had insert/update/delete grants; profiles did NOT
-- have UPDATE -> Settings "Save" + push-token save returned 403 for every user.
-- Column-scoped on purpose: granting blanket UPDATE would let a user set their
-- own subscription_status='active' (payment bypass). Only the columns the app
-- legitimately edits are granted. RLS already restricts to auth.uid() = id.
grant update (pm_name, company_name, push_token) on public.profiles to authenticated;

-- 2026-07-14: SERVICE_ROLE was missing grants (not just `authenticated`). The
-- storm cron uses the service-role key, which bypasses RLS but STILL needs a
-- table-level GRANT. weather_events + zip_geocache were created by raw SQL
-- outside Supabase's default privileges, so service_role got 42501 on both.
--
-- Impact (this was NOT cosmetic): buildGeoCache() in app/api/weather/route.ts
-- reads zip_geocache -> denied -> empty cache EVERY run -> it re-geocodes every
-- ZIP against Nominatim every hour, then the upsert write-back is denied too and
-- the error is swallowed (never checked). So the cache never populated. If
-- Nominatim throttles or blocks the burst, geocodeZip() returns null,
-- alertsByZip[zip] = [], and the cron reports "no storms" instead of failing --
-- storms get silently missed. This grant restores the cache and stops the
-- per-hour re-geocode of every ZIP.
grant select, insert, update on public.zip_geocache to service_role;

-- weather_events: currently dead (nothing writes it), but the schema + RLS
-- expect service_role to insert and authenticated to read. Granting so storm
-- history can actually be logged rather than silently dropped.
grant select, insert on public.weather_events to service_role;
grant select on public.weather_events to authenticated;
