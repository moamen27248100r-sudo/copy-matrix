-- ROLLBACK snapshot for 0208_profiles_rls.sql, captured from pg_policies before the change (2026-09-29).
-- Restores the previous (over-permissive) state: any authenticated user can read every profile row.

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);

-- Existing policies left untouched by the migration, recorded for reference:
--   profiles_update_admin  UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
--   profiles_update_own    UPDATE TO authenticated USING (auth.uid() = id)

DROP FUNCTION IF EXISTS public.lead_trader_follower_labels(uuid[]);
DROP FUNCTION IF EXISTS public.current_user_is_admin();
