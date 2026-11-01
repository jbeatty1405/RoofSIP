-- 2026-11-01: overnight storm texts.
-- A storm that hits an opted-in homeowner during their quiet hours (9pm-8am local)
-- creates the PM lead immediately and parks the homeowner's text here. The storm
-- cron texts it once their window opens and deletes the row; rows older than 13h
-- are dropped unsent. One row per homeowner (first storm of the night wins).
CREATE TABLE IF NOT EXISTS public.storm_text_queue (
  homeowner_id UUID PRIMARY KEY REFERENCES public.homeowners(id) ON DELETE CASCADE,
  roofer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  noaa_alert_id TEXT,
  storm_type TEXT NOT NULL,
  headline TEXT,
  description TEXT,
  ends_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-only table: RLS on with no policies (no client access); the cron uses
-- service_role, which needs an explicit GRANT on this project.
ALTER TABLE public.storm_text_queue ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.storm_text_queue TO service_role;
