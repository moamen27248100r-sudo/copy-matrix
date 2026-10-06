-- Reverts 0245. Restores the previous (insecure) grants -- only for emergencies.
begin;
drop policy if exists kyc_insert_own on public.kyc_submissions;
create policy kyc_insert_own on public.kyc_submissions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists lead_trader_applications_insert_own on public.lead_trader_applications;
create policy lead_trader_applications_insert_own on public.lead_trader_applications for insert to authenticated with check (user_id = auth.uid());
alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('sim_close_trade','sim_open_trade','sim_advance_trade','provider_daily_apply','refresh_provider_stats',
      'refresh_dirty_provider_stats','run_daily_leader_maintenance','mark_provider_stats_dirty','refresh_sim_symbol_volatility',
      'copy_check_leader_account','email_category_enabled','notification_account_type','check_rate_limit')
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
-- start_or_update_copy: restore supabase/rollback/start_or_update_copy.sql separately if needed.
commit;
