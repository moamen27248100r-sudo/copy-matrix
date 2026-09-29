-- 1) follower_invites: drop the USING (true) read policy. Owners keep
--    follower_invites_select_own; invitees accept via the SECURITY DEFINER
--    accept_follower_invite(); admins get an explicit read policy.
DROP POLICY IF EXISTS follower_invites_select_by_code ON public.follower_invites;
CREATE POLICY follower_invites_select_admin ON public.follower_invites FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

-- 2) lead_trader_profiles: keep the public row policy, but stop exposing invite_code
--    through column privileges. The owner reads the code via
--    lead_trader_get_or_create_invite_code() (SECURITY DEFINER).
REVOKE SELECT ON public.lead_trader_profiles FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'lead_trader_profiles' AND column_name <> 'invite_code';
  EXECUTE format('GRANT SELECT (%s) ON public.lead_trader_profiles TO anon, authenticated', cols);
END $$;
