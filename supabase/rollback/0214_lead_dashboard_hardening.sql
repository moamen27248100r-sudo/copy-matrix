ALTER TABLE public.lead_trader_announcements DROP CONSTRAINT IF EXISTS lead_trader_announcements_body_len;
GRANT INSERT, UPDATE, DELETE ON public.lead_trader_payout_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profit_share_ledger TO authenticated;
-- Function EXECUTE for anon/PUBLIC is intentionally not restored (those calls always failed for non-leaders).
-- DROP TABLE public._bak_20260930_lead_trader_announcements;  -- once no longer needed
