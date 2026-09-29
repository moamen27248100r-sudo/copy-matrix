-- Lock down profiles reads. Previously profiles_select was USING (true), so any
-- signed-in user could read every user's email, phone, balance, IPs and is_admin.
-- Now: own row, or admin. Other users' public info goes through safe functions.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) $$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.current_user_is_admin());

-- Display names only (no email/phone/balance/IP/admin flag), and only for users
-- who follow the calling lead trader's provider.
CREATE OR REPLACE FUNCTION public.lead_trader_follower_labels(p_ids uuid[])
 RETURNS TABLE(id uuid, display_name text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT pr.id, pr.display_name
  FROM public.profiles pr
  WHERE pr.id = ANY (p_ids)
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.providers p ON p.id = s.provider_id
      WHERE s.follower_id = pr.id AND p.user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.lead_trader_follower_labels(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lead_trader_follower_labels(uuid[]) TO authenticated;
