-- ============================================================
-- Copy Matrix — fix: synthetic_customers (0104) only granted select
-- to `authenticated`, silently hiding the whole "آخر الناسخين"
-- section from unauthenticated visitors browsing trader profiles.
-- This app has an established public-browsing precedent for exactly
-- this situation (0039_public_trader_profiles.sql added a `to anon`
-- policy on `signals` so guests can see trade history/equity charts)
-- — add the matching policy here.
-- ============================================================

create policy "synthetic_customers_select_public" on public.synthetic_customers
  for select to anon
  using (true);
