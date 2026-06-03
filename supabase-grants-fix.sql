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
