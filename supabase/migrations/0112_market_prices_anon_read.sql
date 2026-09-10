-- ============================================================
-- Copy Matrix — market_prices only had a SELECT policy for
-- `authenticated`, none for `anon`. Any guest (not logged in)
-- viewing a trader's profile got an empty market_prices result,
-- so OpenOrdersTable's live P&L % fell back to "—" for every
-- open order regardless of symbol — not a price-feed problem,
-- a missing anon-read policy. Same gap as 0104 -> 0105 for
-- synthetic_customers.
-- ============================================================

create policy "market_prices_select_public" on public.market_prices
  for select to anon using (true);
