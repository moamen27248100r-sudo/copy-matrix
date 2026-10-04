-- Rollback of 0233_crypto_wallet.sql: removes the crypto wallet tables, functions, triggers and
-- cron job, and re-opens manual wallet requests (0225 policy). Balances already credited or
-- frozen stay as they are; settle open withdrawals before rolling back.
begin;

select cron.unschedule(jobid) from cron.job where jobname = 'crypto-deposit-checks';
drop function if exists public.fire_crypto_deposit_checks();

drop trigger if exists trg_track_password_change on auth.users;
drop trigger if exists trg_track_mfa_change on auth.mfa_factors;

drop function if exists public.admin_crypto_deposit_recheck(uuid);
drop function if exists public.admin_update_crypto_network(text, text, numeric, integer, numeric, numeric, numeric, boolean, boolean);
drop function if exists public.admin_crypto_withdrawal_reject(uuid, text);
drop function if exists public.admin_crypto_withdrawal_complete(uuid, text);
drop function if exists public.admin_crypto_withdrawal_start(uuid);
drop function if exists public.assert_admin();
drop function if exists public.cancel_crypto_withdrawal(uuid);
drop function if exists public.crypto_withdrawal_refund(public.crypto_withdrawals);
drop function if exists public.request_crypto_withdrawal(text, text, numeric);
drop function if exists public.crypto_withdrawn_24h(uuid, text);
drop function if exists public.withdraw_mfa_check();
drop function if exists public.withdraw_locked_until(uuid);
drop function if exists public.track_mfa_change();
drop function if exists public.track_password_change();
drop function if exists public.crypto_deposit_record_check(uuid, jsonb);
drop function if exists public.crypto_deposit_submit(uuid, text, text);
drop function if exists public.crypto_deposit_address_for(uuid, text);

drop table if exists public.crypto_withdrawals;
drop table if exists public.crypto_deposits;
drop table if exists public.account_security_events;
drop table if exists public.crypto_networks;
drop function if exists public.crypto_address_valid(text, text);

update public.wallet_transactions set type = 'deposit' where type = 'withdrawal_refund';
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type = any (array['deposit', 'withdrawal', 'pnl', 'fee', 'admin_adjustment', 'demo_reset']));

grant insert on public.wallet_requests to authenticated;
drop policy if exists wallet_requests_insert_own on public.wallet_requests;
create policy wallet_requests_insert_own on public.wallet_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null);

commit;
