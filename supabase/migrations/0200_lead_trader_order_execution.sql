-- Lead Trader Phase 3: order execution for a self-service lead trader.
-- `signals` only has admin-only INSERT/UPDATE policies (signals_insert_admin,
-- signals_update_admin) -- a lead trader is not an admin, so two new
-- SECURITY DEFINER RPCs are added (same shape as start_or_update_copy /
-- stop_copy / close_my_position): each does its own auth.uid()-based
-- ownership check instead of relying on RLS, so no existing policy needs to
-- change. Every order fills at the current market_prices row (this platform
-- has no real order execution -- see 0001_init.sql's header comment); once
-- inserted, the existing mirror_signal_to_followers() / on_signal_closed
-- triggers pick it up completely unmodified, exactly as they do for an
-- admin-inserted leader trade.

CREATE OR REPLACE FUNCTION public.lead_trader_open_order(
  p_symbol text,
  p_side text,
  p_size numeric,
  p_stop_loss numeric DEFAULT NULL,
  p_take_profit numeric DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_price numeric;
  v_signal_id uuid;
BEGIN
  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'invalid side' USING ERRCODE = 'LT001';
  END IF;
  IF p_size IS NULL OR p_size <= 0 THEN
    RAISE EXCEPTION 'invalid size' USING ERRCODE = 'LT002';
  END IF;

  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT price INTO v_price FROM public.market_prices WHERE symbol = p_symbol;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'unknown symbol' USING ERRCODE = 'LT004';
  END IF;

  INSERT INTO public.signals (provider_id, symbol, side, entry_price, stop_loss, take_profit, status, opened_at, created_by_admin, lot_size)
  VALUES (v_provider_id, p_symbol, p_side, v_price, p_stop_loss, p_take_profit, 'open', now(), false, p_size)
  RETURNING id INTO v_signal_id;

  RETURN v_signal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_open_order(text, text, numeric, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_trader_close_order(p_signal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_symbol text;
  v_price numeric;
BEGIN
  SELECT s.symbol INTO v_symbol
  FROM public.signals s
  JOIN public.providers pr ON pr.id = s.provider_id
  WHERE s.id = p_signal_id AND pr.user_id = auth.uid() AND s.status = 'open'
  FOR UPDATE OF s;

  IF v_symbol IS NULL THEN
    RAISE EXCEPTION 'order not found or already closed' USING ERRCODE = 'LT005';
  END IF;

  SELECT price INTO v_price FROM public.market_prices WHERE symbol = v_symbol;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'no live price' USING ERRCODE = 'LT004';
  END IF;

  UPDATE public.signals SET status = 'closed', exit_price = v_price, closed_at = now() WHERE id = p_signal_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_close_order(uuid) TO authenticated;
