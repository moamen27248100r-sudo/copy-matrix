-- ROLLBACK snapshot for 0209, captured from pg_policies / column_privileges before the change (2026-09-29).
DROP POLICY IF EXISTS follower_invites_select_admin ON public.follower_invites;
DROP POLICY IF EXISTS follower_invites_select_by_code ON public.follower_invites;
CREATE POLICY follower_invites_select_by_code ON public.follower_invites FOR SELECT TO authenticated USING (true);

-- lead_trader_profiles: table-level SELECT (incl. invite_code) for both roles, as before.
GRANT SELECT ON public.lead_trader_profiles TO anon, authenticated;
