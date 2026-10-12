-- 0253: customers can no longer write to signals / providers / simulated_positions at all.
--
-- 1. simulated_positions: the INSERT policy joined signals inside its own check, which made
--    PostgreSQL report "infinite recursion detected in policy" to a client that tried to write.
--    The admin check now goes through current_user_is_admin() and the "signal was created by
--    an admin" test through a security definer helper, so a refused write is a clean 42501.
-- 2. INSERT / UPDATE / DELETE on signals, providers and simulated_positions are revoked from
--    the authenticated role. Every legitimate writer is a security definer function (copy
--    mirroring, closing, lead trader RPCs, the live engine) or the service role (the admin
--    panel server actions, which now use the service-role client for these three tables).
--    The RLS policies stay as a second line of defence.
--
-- Rollback: supabase/rollback/0253_lock_write_grants_and_fix_positions_policy.sql

begin;

create or replace function public.signal_created_by_admin(p_signal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.signals where id = p_signal_id and created_by_admin = true)
$$;
revoke all on function public.signal_created_by_admin(uuid) from public, anon;
grant execute on function public.signal_created_by_admin(uuid) to authenticated, service_role;

drop policy if exists simulated_positions_insert_admin on public.simulated_positions;
create policy simulated_positions_insert_admin on public.simulated_positions
  for insert to authenticated
  with check ((select public.current_user_is_admin()) and public.signal_created_by_admin(signal_id));

drop policy if exists simulated_positions_select_admin on public.simulated_positions;
create policy simulated_positions_select_admin on public.simulated_positions
  for select to authenticated
  using ((select public.current_user_is_admin()));

drop policy if exists simulated_positions_update_admin on public.simulated_positions;
create policy simulated_positions_update_admin on public.simulated_positions
  for update to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

revoke insert, update, delete, truncate, references, trigger on public.signals from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.providers from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.simulated_positions from authenticated;

commit;
