-- Hardening pass after the leader-dashboard review. No data is touched.
--  1) Privileges only: anon/PUBLIC can no longer EXECUTE the lead-trader / payout
--     RPCs (they already raise for non-leaders, this removes the surface), and
--     trigger functions are not callable by API roles at all.
--  2) Write privileges removed from API roles on tables that are written only by
--     SECURITY DEFINER functions / the service role (RLS already had no write
--     policies; this is defence in depth). Backup table is fully closed.
--  3) lead_trader_announcements: direct API inserts had no length cap, and the
--     text is shown to every follower -> CHECK <= 500 chars. NOT VALID so no
--     existing row is scanned or changed. Table copied to a backup first.

CREATE TABLE IF NOT EXISTS public._bak_20260930_lead_trader_announcements AS SELECT * FROM public.lead_trader_announcements;
ALTER TABLE public._bak_20260930_lead_trader_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._bak_20260930_lead_trader_announcements FROM anon, authenticated;
REVOKE ALL ON public._bak_20260930_lead_trader_profiles FROM anon, authenticated;

ALTER TABLE public.lead_trader_announcements
  ADD CONSTRAINT lead_trader_announcements_body_len CHECK (char_length(body) <= 500) NOT VALID;

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'lead\_trader\_%' OR p.proname LIKE 'lead\_dashboard\_%'
           OR p.proname LIKE 'admin\_run\_all\_lead%' OR p.proname LIKE 'notify\_leader\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.proname LIKE 'notify\_leader\_%' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.lead_trader_payout_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profit_share_ledger FROM anon, authenticated;
REVOKE ALL ON public.lead_trader_payout_requests FROM anon;
REVOKE ALL ON public.profit_share_ledger FROM anon;
