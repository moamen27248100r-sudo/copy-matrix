-- Lead Trader Phase 5: profit-share ledger, High Water Mark accounting.
-- Purely additive: two new nullable/defaulted columns on subscriptions
-- (never read by any existing query -- mirror_signal_to_followers,
-- start_or_update_copy, stop_copy, close_my_position are all untouched by
-- this migration), one new table, two new SECURITY DEFINER RPCs that only
-- ever INSERT ledger rows (status='pending'). No balance is ever moved by
-- anything in this file -- that is a separate, feature-flagged step in
-- application code (src/config/lead-trader.ts LEAD_TRADER_MONEY_ENABLED),
-- because profiles.balance can only be written by the service-role client
-- (0180 lockdown) and never by a plain RPC anyway.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS profit_share_hwm numeric NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS profit_share_pct_locked numeric;

CREATE TABLE IF NOT EXISTS public.profit_share_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  follower_id uuid NOT NULL REFERENCES public.profiles(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  gross_pnl numeric NOT NULL,
  profit_share_pct numeric NOT NULL,
  profit_share_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'waived')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profit_share_ledger_provider_idx ON public.profit_share_ledger (provider_id);
CREATE INDEX IF NOT EXISTS profit_share_ledger_follower_idx ON public.profit_share_ledger (follower_id);
CREATE INDEX IF NOT EXISTS profit_share_ledger_subscription_idx ON public.profit_share_ledger (subscription_id);

ALTER TABLE public.profit_share_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY profit_share_ledger_select_provider ON public.profit_share_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = profit_share_ledger.provider_id AND pr.user_id = auth.uid()));

CREATE POLICY profit_share_ledger_select_follower ON public.profit_share_ledger
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid());

CREATE POLICY profit_share_ledger_select_admin ON public.profit_share_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

-- No INSERT/UPDATE policy for `authenticated` at all: every row is written by
-- the SECURITY DEFINER functions below (compute) or by an admin action using
-- the service-role client (settle/apply), matching this codebase's existing
-- convention (see 0007/0181's "sensitive writes only through trusted server
-- logic" pattern).

-- Computes and records this provider's pending profit-share, High-Water-Mark
-- style: only the NEW realized profit above each subscription's own
-- all-time high gets a ledger row; losses are never negative-shared, and
-- must be recovered (equity back above the old high) before any new share
-- is recorded. The share rate is locked to whatever providers.profit_share_pct
-- was on that subscription's FIRST ever settlement (profit_share_pct_locked),
-- so a later rate change never re-prices past periods -- matches "the rate
-- is fixed for the follower the moment they start copying" as closely as
-- possible without a second edit to start_or_update_copy() (which only sets
-- copy_started_at, not a rate): the rate is captured at the first
-- opportunity this system has to record it.
CREATE OR REPLACE FUNCTION public.lead_trader_run_own_settlement()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_current_pct numeric;
  v_count integer := 0;
  v_sub record;
  v_cumulative_pnl numeric;
  v_locked_pct numeric;
  v_period_start timestamptz;
  v_share_base numeric;
BEGIN
  SELECT id, profit_share_pct INTO v_provider_id, v_current_pct FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  FOR v_sub IN
    SELECT id, follower_id, copy_started_at, profit_share_hwm, profit_share_pct_locked
    FROM public.subscriptions
    WHERE provider_id = v_provider_id
  LOOP
    SELECT COALESCE(sum(pnl), 0) INTO v_cumulative_pnl
    FROM public.simulated_positions
    WHERE subscription_id = v_sub.id AND status = 'closed';

    v_share_base := v_cumulative_pnl - v_sub.profit_share_hwm;

    IF v_share_base > 0 THEN
      v_locked_pct := COALESCE(v_sub.profit_share_pct_locked, v_current_pct, 0);

      SELECT max(period_end) INTO v_period_start FROM public.profit_share_ledger WHERE subscription_id = v_sub.id;
      v_period_start := COALESCE(v_period_start, v_sub.copy_started_at, now());

      IF v_locked_pct > 0 THEN
        INSERT INTO public.profit_share_ledger (subscription_id, provider_id, follower_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount)
        VALUES (v_sub.id, v_provider_id, v_sub.follower_id, v_period_start, now(), v_share_base, v_locked_pct, round(v_share_base * v_locked_pct / 100, 2));
        v_count := v_count + 1;
      END IF;

      UPDATE public.subscriptions
      SET profit_share_hwm = v_cumulative_pnl,
          profit_share_pct_locked = COALESCE(profit_share_pct_locked, v_current_pct)
      WHERE id = v_sub.id;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_run_own_settlement() TO authenticated;

-- Same computation, run for every self-service lead trader at once --
-- intended for a weekly scheduled call (admin action or a protected cron
-- route) rather than a per-provider button. Admin-only.
CREATE OR REPLACE FUNCTION public.admin_run_all_lead_trader_settlements()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider record;
  v_current_pct numeric;
  v_sub record;
  v_cumulative_pnl numeric;
  v_locked_pct numeric;
  v_period_start timestamptz;
  v_share_base numeric;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'LT010';
  END IF;

  FOR v_provider IN SELECT pr.id, pr.profit_share_pct FROM public.providers pr JOIN public.lead_trader_profiles ltp ON ltp.provider_id = pr.id LOOP
    v_current_pct := v_provider.profit_share_pct;
    FOR v_sub IN
      SELECT id, follower_id, copy_started_at, profit_share_hwm, profit_share_pct_locked
      FROM public.subscriptions
      WHERE provider_id = v_provider.id
    LOOP
      SELECT COALESCE(sum(pnl), 0) INTO v_cumulative_pnl
      FROM public.simulated_positions
      WHERE subscription_id = v_sub.id AND status = 'closed';

      v_share_base := v_cumulative_pnl - v_sub.profit_share_hwm;

      IF v_share_base > 0 THEN
        v_locked_pct := COALESCE(v_sub.profit_share_pct_locked, v_current_pct, 0);
        SELECT max(period_end) INTO v_period_start FROM public.profit_share_ledger WHERE subscription_id = v_sub.id;
        v_period_start := COALESCE(v_period_start, v_sub.copy_started_at, now());

        IF v_locked_pct > 0 THEN
          INSERT INTO public.profit_share_ledger (subscription_id, provider_id, follower_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount)
          VALUES (v_sub.id, v_provider.id, v_sub.follower_id, v_period_start, now(), v_share_base, v_locked_pct, round(v_share_base * v_locked_pct / 100, 2));
          v_count := v_count + 1;
        END IF;

        UPDATE public.subscriptions
        SET profit_share_hwm = v_cumulative_pnl,
            profit_share_pct_locked = COALESCE(profit_share_pct_locked, v_current_pct)
        WHERE id = v_sub.id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_run_all_lead_trader_settlements() TO authenticated;
