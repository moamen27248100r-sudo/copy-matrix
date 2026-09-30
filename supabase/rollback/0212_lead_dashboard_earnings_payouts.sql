-- Rolls back 0212. Drops the payout table (new in 0212, so nothing pre-existing is lost).
DROP FUNCTION IF EXISTS public.lead_dashboard_cancel_payout(uuid);
DROP FUNCTION IF EXISTS public.lead_dashboard_request_payout(numeric, text);
DROP FUNCTION IF EXISTS public.lead_dashboard_earnings();
DROP TABLE IF EXISTS public.lead_trader_payout_requests;
