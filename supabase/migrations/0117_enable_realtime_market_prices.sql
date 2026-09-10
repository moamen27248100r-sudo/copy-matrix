-- ============================================================
-- Copy Matrix — enable Supabase Realtime (a managed WebSocket feed,
-- not our own server) on market_prices so the frontend can subscribe
-- directly to price changes instead of polling an SSE endpoint.
-- Respects the same RLS policies as a normal read (anon + authenticated
-- already granted SELECT in 0112), so this works for guests too.
-- ============================================================

alter publication supabase_realtime add table public.market_prices;
