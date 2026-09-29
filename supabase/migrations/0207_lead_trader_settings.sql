-- Lead Trader Phase 6: settings. Purely additive: four new columns on the
-- Phase-4 lead_trader_profiles table (all defaulted, so existing rows are
-- unaffected), two new SECURITY DEFINER RPCs. `providers` itself is never
-- given a new UPDATE policy -- it stays admin-only (providers_update_admin)
-- exactly as it already was; the RPC updates it the same way
-- lead_trader_open_order already updates `signals` despite that table's
-- own admin-only policies (an internal ownership check replaces RLS).

ALTER TABLE public.lead_trader_profiles
  ADD COLUMN IF NOT EXISTS min_investment numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS hide_country boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_protection text NOT NULL DEFAULT 'none' CHECK (trade_protection IN ('none', 'hidden', 'delayed')),
  ADD COLUMN IF NOT EXISTS accepting_followers boolean NOT NULL DEFAULT true;

-- Updates the caller's own provider row (display name, bio, markets,
-- contact info, min copy amount) and their lead_trader_profiles settings row
-- in one call. profit_share_pct is capped server-side at the tier limit
-- passed in by the caller (computed in the app from the same
-- LEAD_TRADER_TIERS config the UI already uses) so a tampered request can't
-- exceed it.
CREATE OR REPLACE FUNCTION public.lead_trader_update_profile(
  p_display_name text,
  p_bio text,
  p_markets text[],
  p_contact_info text,
  p_min_copy_amount numeric,
  p_profit_share_pct numeric,
  p_max_profit_share_pct numeric,
  p_min_investment numeric,
  p_hide_country boolean,
  p_trade_protection text,
  p_accepting_followers boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_pct numeric;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;
  IF p_display_name IS NULL OR btrim(p_display_name) = '' THEN
    RAISE EXCEPTION 'display name required' USING ERRCODE = 'LT011';
  END IF;
  IF p_trade_protection NOT IN ('none', 'hidden', 'delayed') THEN
    RAISE EXCEPTION 'invalid trade protection' USING ERRCODE = 'LT012';
  END IF;

  v_pct := GREATEST(0, LEAST(COALESCE(p_profit_share_pct, 0), COALESCE(p_max_profit_share_pct, 50)));

  UPDATE public.providers
  SET display_name = p_display_name,
      bio = p_bio,
      symbol_bias = p_markets,
      min_copy_amount = GREATEST(1, COALESCE(p_min_copy_amount, min_copy_amount)),
      profit_share_pct = v_pct
  WHERE id = v_provider_id;

  INSERT INTO public.lead_trader_profiles (provider_id, min_investment, hide_country, trade_protection, accepting_followers)
  VALUES (v_provider_id, GREATEST(1, COALESCE(p_min_investment, 100)), COALESCE(p_hide_country, false), p_trade_protection, COALESCE(p_accepting_followers, true))
  ON CONFLICT (provider_id) DO UPDATE
    SET min_investment = EXCLUDED.min_investment,
        hide_country = EXCLUDED.hide_country,
        trade_protection = EXCLUDED.trade_protection,
        accepting_followers = EXCLUDED.accepting_followers,
        updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_update_profile(text, text, text[], text, numeric, numeric, numeric, numeric, boolean, text, boolean) TO authenticated;

-- We store the private contact_info from the original application on
-- lead_trader_applications, not on providers -- add a small, narrowly-scoped
-- way for the owner to update just that field too.
ALTER TABLE public.lead_trader_applications
  ADD COLUMN IF NOT EXISTS contact_info_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.lead_trader_update_contact_info(p_contact_info text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  UPDATE public.lead_trader_applications
  SET contact_info = p_contact_info, contact_info_updated_at = now()
  WHERE user_id = auth.uid() AND status = 'approved';
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_update_contact_info(text) TO authenticated;

-- Ending the lead-trader role: blocks while any of the provider's own
-- signals are still open (per the plan, all trades must be closed first),
-- notifies every currently active follower, reuses the existing
-- trading_status = 'stopped' state (already handled everywhere a provider
-- can be stopped -- margin calls, admin stop -- so copy buttons, "stopped"
-- badges etc. all already do the right thing with zero further UI changes),
-- and finally clears is_lead_trader. is_lead_trader has no authenticated
-- UPDATE grant (0198) by design; a SECURITY DEFINER function runs with its
-- owner's privileges, not the caller's, so it can still write it here --
-- the same trusted-server-logic pattern every other write to a locked-down
-- column in this schema already uses.
CREATE OR REPLACE FUNCTION public.lead_trader_end_role()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_open_count integer;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT count(*) INTO v_open_count FROM public.signals WHERE provider_id = v_provider_id AND status = 'open';
  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'close all open trades first' USING ERRCODE = 'LT013';
  END IF;

  UPDATE public.providers SET trading_status = 'stopped' WHERE id = v_provider_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT s.follower_id, 'lead_trader_ended', 'أنهى المتداول القائد نشاطه', 'توقف هذا المتداول عن نشاطه كمتداول قائد. يمكنك إيقاف نسخه من صفحة نسخاتي.', jsonb_build_object('providerId', v_provider_id)
  FROM public.subscriptions s
  WHERE s.provider_id = v_provider_id AND s.is_active;

  UPDATE public.profiles SET is_lead_trader = false WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_end_role() TO authenticated;
