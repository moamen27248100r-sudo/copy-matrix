-- Rollback for 0225. Restores the previous (permissive) grants.
-- WARNING: re-opens deposit_funds / withdraw_funds / self_approve_wallet_request
-- to every signed-in user, i.e. they can credit their own balance.

begin;

grant execute on function public.self_approve_wallet_request(uuid) to public, anon, authenticated;
grant execute on function public.deposit_funds(numeric, text) to public, anon, authenticated;
grant execute on function public.withdraw_funds(numeric, text) to public, anon, authenticated;

drop policy if exists wallet_requests_insert_own on public.wallet_requests;
create policy wallet_requests_insert_own on public.wallet_requests
  for insert to authenticated with check (user_id = auth.uid());

grant all on public.wallet_requests, public.wallet_transactions, public.profiles to anon;
grant update, delete, truncate, references, trigger on public.wallet_requests to authenticated;
grant update, delete, truncate, references, trigger on public.wallet_transactions to authenticated;
grant insert, delete, truncate, references, trigger on public.profiles to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'run_market_simulation()', 'run_daily_leader_lifecycle()', 'fire_price_fetch_requests()',
    'apply_price_fetch_responses()', 'generate_trader_posts()', 'cleanup_http_responses()',
    'cleanup_old_price_history()', 'cleanup_cron_job_run_details()', 'refresh_provider_performance()',
    'rls_auto_enable()',
    'accept_follower_invite(text)', 'close_my_position(uuid)', 'start_or_update_copy(uuid, numeric)',
    'stop_copy(uuid)', 'record_login(text, text)', 'touch_last_seen()'
  ] loop
    execute format('grant execute on function public.%s to public, anon, authenticated', f);
  end loop;
end $$;

alter table public._price_fetch_state disable row level security;
grant all on public._price_fetch_state to anon, authenticated;

-- Tables on which anon held full privileges before 0225 (later migrations had
-- already revoked anon from the trade-integrity / backup tables).
do $$
declare t text;
begin
  foreach t in array array[
    'admin_audit_log', 'follower_invites', 'follows', 'kyc_submissions', 'lead_trader_announcements',
    'lead_trader_applications', 'lead_trader_follower_removals', 'lead_trader_profiles', 'market_prices',
    'notifications', 'price_history', 'provider_cards', 'provider_followers', 'provider_performance',
    'provider_performance_mv', 'providers', 'rate_limits', 'signals', 'simulated_positions',
    'subscriptions', 'trader_posts'
  ] loop
    execute format('grant all on public.%I to anon', t);
  end loop;
end $$;

alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant execute on functions to anon;
alter default privileges for role postgres grant execute on functions to public;

commit;
