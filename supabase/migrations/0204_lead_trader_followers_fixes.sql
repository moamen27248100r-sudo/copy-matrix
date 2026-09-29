-- Two bugs found testing Phase 4:
-- 1) follower_invites had no INSERT policy at all (RLS defaults to deny),
--    so a lead trader could never actually create an invite.
-- 2) lead_trader_get_or_create_invite_code() used gen_random_bytes(), which
--    needs the pgcrypto extension (not enabled here) -- switched to
--    gen_random_uuid(), already used everywhere else in this schema.

CREATE POLICY follower_invites_insert_own ON public.follower_invites
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = follower_invites.provider_id AND pr.user_id = auth.uid()));

GRANT INSERT ON public.follower_invites TO authenticated;

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

  v_code := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.lead_trader_profiles (provider_id, invite_code)
  VALUES (v_provider_id, v_code)
  ON CONFLICT (provider_id) DO UPDATE SET invite_code = COALESCE(public.lead_trader_profiles.invite_code, EXCLUDED.invite_code)
  RETURNING invite_code INTO v_code;

  RETURN v_code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_get_or_create_invite_code() TO authenticated;
