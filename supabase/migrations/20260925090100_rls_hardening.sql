-- Precision POP demo: RLS hardening (P0 security fixes)
--
-- Closes the holes found in the 2026-09-25 audit:
--  1. brand-images storage: any authenticated user could upload/overwrite/delete.
--  2. retailers: any authenticated user could insert/update/delete any row.
--  3. offer_accepts / offer_declines: permissive "System can insert" policies
--     (no TO clause => applies to anon) let anyone fabricate behavioral events.
--
-- After this migration:
--  - brand-images: public READ stays (demo needs it); writes are service-role only.
--  - retailers: public read stays ("Anyone can view retailers"); writes are
--    service-role only. (The be-repo "Retailers can update their own data"
--    policy is preserved for future authenticated retailer accounts.)
--  - offer_accepts / offer_declines / offer_impressions: retailer SELECT
--    policies preserved; open INSERT policies removed. Shopper events now go
--    to swipe_events (see 20260925090000_swipe_events.sql).
--
-- APPLY: Supabase Dashboard -> SQL Editor -> run this file. Safe to re-run
-- (all drops are IF EXISTS).

-- ============ 1. brand-images storage: fail writes closed ============
DROP POLICY IF EXISTS "Authenticated users can upload brand images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update brand images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete brand images" ON storage.objects;
-- Public read ("Anyone can view brand images" / "Public can view brand images") is kept.

-- ============ 2. retailers: fail writes closed for client roles ============
DROP POLICY IF EXISTS "Authenticated users can insert retailers" ON public.retailers;
DROP POLICY IF EXISTS "Authenticated users can update retailers" ON public.retailers;
DROP POLICY IF EXISTS "Authenticated users can delete retailers" ON public.retailers;
-- Kept: "Anyone can view retailers" (public read for the demo).

-- ============ 3. behavioral event tables: remove open inserts ============
DROP POLICY IF EXISTS "System can insert accepts" ON public.offer_accepts;
DROP POLICY IF EXISTS "System can insert declines" ON public.offer_declines;
-- Kept: retailer SELECT policies ("Retailers can view accepts/declines/impressions
-- for their customers"). Inserts are now service-role only until the authenticated
-- shopper write path exists.
