-- Wallet / privilege lockdown.
--
-- 1. No user-callable path may credit a balance. deposit_funds() and
--    withdraw_funds() (0009) moved the caller's balance directly, and
--    self_approve_wallet_request() (0090) let a user approve their own pending
--    request, so any signed-in user could mint money. All three are revoked
--    (the app no longer calls them); deposits/withdrawals now stay 'pending'
--    until an admin approves them (the apply_wallet_request trigger then
--    credits/debits).
-- 2. wallet_requests can only be inserted as 'pending'.
-- 3. Internal cron / maintenance functions are not callable through the API.
-- 4. _price_fetch_state gets RLS and no API grants (cron runs as the owner).
-- 5. anon is read-only and cannot read private tables; profiles loses its
--    leftover insert/delete grants for authenticated.
-- 6. SECURITY DEFINER RPCs that need a signed-in user are no longer
--    executable by anon.

begin;

-- 1 ------------------------------------------------------------------------
revoke all on function public.self_approve_wallet_request(uuid) from public, anon, authenticated;
revoke all on function public.deposit_funds(numeric, text) from public, anon, authenticated;
revoke all on function public.withdraw_funds(numeric, text) from public, anon, authenticated;

-- 2 ------------------------------------------------------------------------
drop policy if exists wallet_requests_insert_own on public.wallet_requests;
create policy wallet_requests_insert_own on public.wallet_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null);

revoke all on public.wallet_requests from anon;
revoke update, delete, truncate, references, trigger on public.wallet_requests from authenticated;
grant update (status, amount) on public.wallet_requests to authenticated; -- admin review only (RLS)

revoke all on public.wallet_transactions from anon;
revoke update, delete, truncate, references, trigger on public.wallet_transactions from authenticated;

-- 3 ------------------------------------------------------------------------
revoke all on function public.run_market_simulation() from public, anon, authenticated;
revoke all on function public.run_daily_leader_lifecycle() from public, anon, authenticated;
revoke all on function public.fire_price_fetch_requests() from public, anon, authenticated;
revoke all on function public.apply_price_fetch_responses() from public, anon, authenticated;
revoke all on function public.generate_trader_posts() from public, anon, authenticated;
revoke all on function public.cleanup_http_responses() from public, anon, authenticated;
revoke all on function public.cleanup_old_price_history() from public, anon, authenticated;
revoke all on function public.cleanup_cron_job_run_details() from public, anon, authenticated;
revoke all on function public.refresh_provider_performance() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- 4 ------------------------------------------------------------------------
alter table public._price_fetch_state enable row level security;
revoke all on public._price_fetch_state from public, anon, authenticated;

-- 5 ------------------------------------------------------------------------
revoke all on public.profiles from public, anon;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;

-- anon is read-only everywhere...
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon', r.relname);
  end loop;
end $$;

-- ...and has no business reading private tables (none has an anon policy).
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'wallet_requests', 'wallet_transactions', 'kyc_submissions', 'notifications',
    'admin_audit_log', 'rate_limits', 'follower_invites', 'lead_trader_follower_removals',
    'lead_trader_applications', 'lead_trader_payout_requests', 'profit_share_ledger',
    'subscriptions', 'simulated_positions', 'lead_trader_announcements'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke select on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- 6 ------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.accept_follower_invite(text)',
    'public.close_my_position(uuid)',
    'public.start_or_update_copy(uuid, numeric)',
    'public.stop_copy(uuid)',
    'public.record_login(text, text)',
    'public.touch_last_seen()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Future objects: not exposed to anon by default.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

commit;
