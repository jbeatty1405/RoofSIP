-- Applied to prod (bzdkftdaclmrblyhoweo) 2026-07-24 via Supabase MCP as migration
-- `billing_events_ledger_and_internal_flag`. Kept here for version control.
--
-- Permanent, append-only billing ledger. Survives profile/account deletion so
-- churn (who cancelled + when) is never lost the way Ryan Orefice's was.
create table if not exists public.billing_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null,               -- created|updated|canceled|paused|resumed|payment_failed|payment_succeeded
  stripe_event_id text unique,            -- evt_... ; unique so webhook retries dedupe
  stripe_customer_id text,
  stripe_subscription_id text,
  user_id uuid,                           -- profile/auth id at event time (may later be deleted)
  email text,
  pm_name text,
  company_name text,
  sub_status text,                        -- stripe subscription.status at event time
  amount_cents integer,                   -- monthly price (lifecycle) or amount paid (invoice)
  currency text default 'usd',
  raw jsonb
);

create index if not exists billing_events_sub_idx on public.billing_events (stripe_subscription_id);
create index if not exists billing_events_customer_idx on public.billing_events (stripe_customer_id);
create index if not exists billing_events_created_idx on public.billing_events (created_at desc);
create index if not exists billing_events_type_idx on public.billing_events (event_type);

-- RLS on, no policies: only the service role (which bypasses RLS) can read/write.
-- The webhook and the admin API both use the service-role client.
alter table public.billing_events enable row level security;

-- Separate internal Prowest seats from real external customers in the counts.
alter table public.profiles add column if not exists is_internal boolean not null default false;
