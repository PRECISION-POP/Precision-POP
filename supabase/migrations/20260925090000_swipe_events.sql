-- Precision POP demo: swipe_events table
--
-- Append-only event log for the shopper swipe deck. Keyed by anonymous
-- device_id (no FKs) so it works with the demo's string coupon ids and
-- without requiring shopper login.
--
-- APPLY: Supabase Dashboard -> SQL Editor -> run this file. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.swipe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id TEXT,
  coupon_id TEXT NOT NULL,
  coupon_title TEXT,
  brand TEXT,
  category TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  method TEXT NOT NULL DEFAULT 'gesture' CHECK (method IN ('gesture', 'button')),
  decline_reason TEXT,
  view_duration_ms INTEGER NOT NULL DEFAULT 0,
  drag_distance DOUBLE PRECISION NOT NULL DEFAULT 0,
  swipe_velocity DOUBLE PRECISION NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  is_personalized BOOLEAN NOT NULL DEFAULT false,
  session_id TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swipe_events_device ON public.swipe_events(device_id);
CREATE INDEX IF NOT EXISTS idx_swipe_events_coupon ON public.swipe_events(coupon_id);
CREATE INDEX IF NOT EXISTS idx_swipe_events_direction ON public.swipe_events(direction);
CREATE INDEX IF NOT EXISTS idx_swipe_events_created ON public.swipe_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swipe_events_decline_reason ON public.swipe_events(decline_reason)
  WHERE decline_reason IS NOT NULL;

ALTER TABLE public.swipe_events ENABLE ROW LEVEL SECURITY;

-- Append-only for anonymous shoppers: INSERT only. No SELECT/UPDATE/DELETE
-- for anon or authenticated roles, so the behavioral dataset cannot be
-- poisoned, scraped, or rewritten from the client. Dashboards read it via
-- the service role / a future authenticated retailer policy.
DROP POLICY IF EXISTS "swipe_events_anon_insert" ON public.swipe_events;
CREATE POLICY "swipe_events_anon_insert"
  ON public.swipe_events FOR INSERT
  TO anon
  WITH CHECK (true);
