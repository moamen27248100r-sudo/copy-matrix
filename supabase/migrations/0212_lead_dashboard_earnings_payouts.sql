-- Leader dashboard phase 3: earnings summary + payout (withdrawal) requests.
-- Additive only: one new table, three SECURITY DEFINER functions. No existing
-- table or function is modified.
--
-- Money model: profit_share_ledger rows are already High-Water-Mark based
-- (0206: only NEW profit above each subscription's all-time high is recorded).
-- Settling a ledger row credits the leader's profiles.balance (admin action,
-- feature-flagged). "Available to withdraw" = settled earnings minus payout
-- requests that are pending or approved, so pending/unsettled money can never
-- be requested. Approval (admin, service role) is what debits the balance.

CREATE TABLE IF NOT EXISTS public.lead_trader_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL CHECK (amount > 0),
  destination text NOT NULL CHECK (length(btrim(destination)) BETWEEN 3 AND 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS lead_trader_payout_requests_user_idx ON public.lead_trader_payout_requests (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lead_trader_payout_requests_one_pending ON public.lead_trader_payout_requests (user_id) WHERE status = 'pending';

ALTER TABLE public.lead_trader_payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_trader_payout_requests_select_own ON public.lead_trader_payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY lead_trader_payout_requests_select_admin ON public.lead_trader_payout_requests
  FOR SELECT TO authenticated USING (public.current_user_is_admin());
-- No INSERT/UPDATE/DELETE policies: writes happen only through the RPCs below
-- and the admin server action (service role).

CREATE OR REPLACE FUNCTION public.lead_dashboard_earnings()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
  v_rate numeric;
  v_settled numeric; v_pending numeric; v_reserved numeric;
  v_monthly jsonb;
BEGIN
  SELECT id, profit_share_pct INTO v_pid, v_rate FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT COALESCE(sum(profit_share_amount) FILTER (WHERE status = 'settled'), 0),
         COALESCE(sum(profit_share_amount) FILTER (WHERE status = 'pending'), 0)
    INTO v_settled, v_pending
  FROM public.profit_share_ledger WHERE provider_id = v_pid;

  SELECT COALESCE(sum(amount), 0) INTO v_reserved
  FROM public.lead_trader_payout_requests WHERE user_id = auth.uid() AND status IN ('pending', 'approved');

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.month DESC), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           round(sum(gross_pnl)::numeric, 2) AS new_profit_above_hwm,
           round(sum(profit_share_amount)::numeric, 2) AS share,
           round(sum(profit_share_amount) FILTER (WHERE status = 'settled')::numeric, 2) AS settled,
           round(sum(profit_share_amount) FILTER (WHERE status = 'pending')::numeric, 2) AS pending
    FROM public.profit_share_ledger
    WHERE provider_id = v_pid AND status <> 'waived' AND created_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  ) m;

  RETURN jsonb_build_object(
    'rate', COALESCE(v_rate, 0),
    'settled_total', v_settled,
    'pending_total', v_pending,
    'available', greatest(0, v_settled - v_reserved),
    'hwm_total', COALESCE((SELECT sum(profit_share_hwm) FROM public.subscriptions WHERE provider_id = v_pid), 0),
    'monthly', v_monthly
  );
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_earnings() TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_dashboard_request_payout(p_amount numeric, p_destination text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
  v_settled numeric; v_reserved numeric; v_id uuid;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;
  IF p_amount IS NULL OR p_amount < 10 THEN
    RAISE EXCEPTION 'amount below minimum' USING ERRCODE = 'LT020';
  END IF;
  IF p_destination IS NULL OR length(btrim(p_destination)) < 3 THEN
    RAISE EXCEPTION 'destination required' USING ERRCODE = 'LT021';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('payout:' || auth.uid()::text, 0));

  IF EXISTS (SELECT 1 FROM public.lead_trader_payout_requests WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'pending request exists' USING ERRCODE = 'LT022';
  END IF;

  SELECT COALESCE(sum(profit_share_amount), 0) INTO v_settled
  FROM public.profit_share_ledger WHERE provider_id = v_pid AND status = 'settled';
  SELECT COALESCE(sum(amount), 0) INTO v_reserved
  FROM public.lead_trader_payout_requests WHERE user_id = auth.uid() AND status IN ('pending', 'approved');

  IF p_amount > v_settled - v_reserved THEN
    RAISE EXCEPTION 'exceeds available' USING ERRCODE = 'LT023';
  END IF;

  INSERT INTO public.lead_trader_payout_requests (provider_id, user_id, amount, destination)
  VALUES (v_pid, auth.uid(), round(p_amount, 2), btrim(p_destination))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_request_payout(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_request_payout(numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_dashboard_cancel_payout(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.lead_trader_payout_requests
  SET status = 'cancelled', reviewed_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_cancel_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_cancel_payout(uuid) TO authenticated;
