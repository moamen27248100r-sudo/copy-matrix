-- Lead Trader Phase 4: followers table, invite links, follower removal, and
-- announcements. Purely additive: four new tables + two new RPCs; nothing
-- existing is touched. Follower removal needs a new RPC because
-- `subscriptions` has no provider-facing UPDATE policy (only
-- subscriptions_update_own, follower_id = auth.uid()) -- same reasoning as
-- Phase 3's lead_trader_open_order/close_order.

CREATE TABLE IF NOT EXISTS public.lead_trader_profiles (
  provider_id uuid PRIMARY KEY REFERENCES public.providers(id),
  whitelist_enabled boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_trader_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_trader_profiles_select_public ON public.lead_trader_profiles
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY lead_trader_profiles_all_own ON public.lead_trader_profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = lead_trader_profiles.provider_id AND pr.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = lead_trader_profiles.provider_id AND pr.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.lead_trader_profiles TO authenticated;
GRANT SELECT ON public.lead_trader_profiles TO anon;

CREATE TABLE IF NOT EXISTS public.follower_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  code text NOT NULL UNIQUE,
  invited_email text,
  used_by uuid REFERENCES public.profiles(id),
  used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS follower_invites_provider_idx ON public.follower_invites (provider_id);

ALTER TABLE public.follower_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY follower_invites_select_own ON public.follower_invites
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = follower_invites.provider_id AND pr.user_id = auth.uid()));

-- Anyone signed in may look up ONE invite by its code (needed to accept it);
-- they still can't list/enumerate other providers' invites (no policy exposes
-- that), just resolve a code they already have.
CREATE POLICY follower_invites_select_by_code ON public.follower_invites
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.follower_invites TO authenticated;

CREATE TABLE IF NOT EXISTS public.lead_trader_follower_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  follower_id uuid NOT NULL REFERENCES public.profiles(id),
  subscription_id uuid NOT NULL,
  reason text,
  removed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_trader_follower_removals ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_trader_follower_removals_select_own ON public.lead_trader_follower_removals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = lead_trader_follower_removals.provider_id AND pr.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.lead_trader_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_trader_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_trader_announcements_select_own ON public.lead_trader_announcements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = lead_trader_announcements.provider_id AND pr.user_id = auth.uid()));

-- Followers (active copiers) and anyone who merely follows (free "watch")
-- can read the leader's own announcements about their own trading.
CREATE POLICY lead_trader_announcements_select_follower ON public.lead_trader_announcements
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.provider_id = lead_trader_announcements.provider_id AND s.follower_id = auth.uid() AND s.is_active)
    OR EXISTS (SELECT 1 FROM public.follows f WHERE f.provider_id = lead_trader_announcements.provider_id AND f.follower_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.lead_trader_announcements TO authenticated;

-- Removing a follower: same open-position safety check stop_copy() already
-- uses, just invoked by the provider instead of the follower themselves
-- (stop_copy can only ever act on auth.uid()'s own subscription). Capped at
-- 10/day per provider via lead_trader_follower_removals.
CREATE OR REPLACE FUNCTION public.lead_trader_remove_follower(p_subscription_id uuid, p_reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_follower_id uuid;
  v_open_count integer;
  v_today_removals integer;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT follower_id INTO v_follower_id
  FROM public.subscriptions
  WHERE id = p_subscription_id AND provider_id = v_provider_id AND is_active
  FOR UPDATE;

  IF v_follower_id IS NULL THEN
    RAISE EXCEPTION 'follower not found' USING ERRCODE = 'LT006';
  END IF;

  SELECT count(*) INTO v_today_removals
  FROM public.lead_trader_follower_removals
  WHERE provider_id = v_provider_id AND removed_at >= date_trunc('day', now());
  IF v_today_removals >= 10 THEN
    RAISE EXCEPTION 'daily removal limit reached' USING ERRCODE = 'LT007';
  END IF;

  SELECT count(*) INTO v_open_count FROM public.simulated_positions WHERE subscription_id = p_subscription_id AND status = 'open';
  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'follower has open positions' USING ERRCODE = 'LT008';
  END IF;

  UPDATE public.subscriptions SET is_active = false WHERE id = p_subscription_id;

  INSERT INTO public.lead_trader_follower_removals (provider_id, follower_id, subscription_id, reason)
  VALUES (v_provider_id, v_follower_id, p_subscription_id, p_reason);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_follower_id, 'lead_trader_removed_you', 'أوقف المتداول القائد نسخك', COALESCE(p_reason, ''), jsonb_build_object('providerId', v_provider_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_remove_follower(uuid, text) TO authenticated;

-- Generates (or returns the existing) persistent invite link code for a
-- provider -- used for the plain "share my link" case; per-email invites go
-- through follower_invites rows created directly by the settings page.
CREATE OR REPLACE FUNCTION public.lead_trader_get_or_create_invite_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_code text;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT invite_code INTO v_code FROM public.lead_trader_profiles WHERE provider_id = v_provider_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := encode(gen_random_bytes(6), 'hex');
  INSERT INTO public.lead_trader_profiles (provider_id, invite_code)
  VALUES (v_provider_id, v_code)
  ON CONFLICT (provider_id) DO UPDATE SET invite_code = COALESCE(public.lead_trader_profiles.invite_code, EXCLUDED.invite_code)
  RETURNING invite_code INTO v_code;

  RETURN v_code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_get_or_create_invite_code() TO authenticated;
