-- Crypto wallet: USDT deposits verified on-chain by TxID, USDT withdrawals with frozen funds.
-- Rollback: supabase/rollback/0233_crypto_wallet.sql
--
--  * crypto_networks: per-network settings managed from the admin panel (TRC20 / BEP20 / ERC20):
--    deposit address, minimum deposit, required confirmations, flat withdrawal fee, minimum
--    withdrawal, daily withdrawal limit, deposit / withdrawal switches. A network without a
--    deposit address is never offered for deposits.
--  * crypto_deposits: one row per submitted TxID. The server verifies the transaction on-chain
--    (src/lib/crypto) and reports what it found to crypto_deposit_record_check(), which decides:
--    still waiting (x/N confirmations), completed (credits the real wallet once), or failed with a
--    reason. A TxID can never be active twice (partial unique index), so it is credited at most once.
--    The address a deposit is checked against comes from crypto_deposit_address_for(), the single
--    place to change when every customer gets an own deposit address.
--  * crypto_withdrawals: the amount is debited (frozen) the moment the request is made and given
--    back if the customer cancels (only while 'processing') or the back office rejects it. The back
--    office first marks it 'sending' (no longer cancellable), then completes it with the TxID.
--    Requests need a verified authenticator (2FA) and a code entered within the last 5 minutes,
--    approved identity verification, no open copied trade, and no password / 2FA change within
--    the last 24 hours (account_security_events, kept by triggers on auth.users / auth.mfa_factors).
--  * wallet_requests (manual requests with a typed amount) is retired: kept for history, no new rows.

begin;

-- Networks --------------------------------------------------------------------------------------
create table public.crypto_networks (
  id text primary key check (id in ('TRC20', 'BEP20', 'ERC20')),
  deposit_address text,
  min_deposit numeric not null check (min_deposit > 0),
  confirmations integer not null check (confirmations between 1 and 500),
  withdraw_fee numeric not null check (withdraw_fee >= 0),
  min_withdraw numeric not null check (min_withdraw > 0),
  daily_withdraw_limit numeric not null check (daily_withdraw_limit > 0),
  deposit_enabled boolean not null default true,
  withdraw_enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint crypto_networks_fee_below_min check (withdraw_fee < min_withdraw)
);

insert into public.crypto_networks
  (id, min_deposit, confirmations, withdraw_fee, min_withdraw, daily_withdraw_limit, sort_order)
values
  ('TRC20', 10, 20, 1, 10, 50000, 1),
  ('BEP20', 10, 15, 0.5, 10, 50000, 2),
  ('ERC20', 20, 12, 5, 20, 50000, 3);

-- Address shape per network: Tron base58 (T + 33 chars), EVM 0x + 40 hex.
create or replace function public.crypto_address_valid(p_network text, p_address text)
returns boolean language sql immutable as $$
  select case
    when p_address is null then false
    when p_network = 'TRC20' then p_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
    when p_network in ('BEP20', 'ERC20') then p_address ~ '^0x[0-9a-fA-F]{40}$'
    else false
  end
$$;

alter table public.crypto_networks add constraint crypto_networks_address_check
  check (deposit_address is null or public.crypto_address_valid(id, deposit_address));

alter table public.crypto_networks enable row level security;
revoke all on public.crypto_networks from anon, authenticated;
grant select on public.crypto_networks to authenticated;
create policy crypto_networks_select on public.crypto_networks for select to authenticated using (true);

-- Deposits --------------------------------------------------------------------------------------
create table public.crypto_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  network text not null references public.crypto_networks (id),
  -- 64 lowercase hex characters, stored without 0x for every network so one hash is one row.
  tx_hash text not null check (tx_hash ~ '^[0-9a-f]{64}$'),
  deposit_address text not null,
  amount numeric check (amount is null or amount > 0),
  from_address text,
  block_number bigint,
  confirmations integer not null default 0,
  required_confirmations integer not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  failure_reason text check (failure_reason in ('not_found', 'wrong_recipient', 'wrong_token', 'tx_failed', 'below_minimum', 'expired')),
  check_attempts integer not null default 0,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint crypto_deposits_failed_reason check ((status = 'failed') = (failure_reason is not null)),
  constraint crypto_deposits_completed_amount check (status <> 'completed' or amount is not null)
);

create unique index crypto_deposits_tx_hash_active on public.crypto_deposits (tx_hash) where status <> 'failed';
create index crypto_deposits_user on public.crypto_deposits (user_id, created_at desc);
create index crypto_deposits_due on public.crypto_deposits (next_check_at) where status = 'pending';

alter table public.crypto_deposits enable row level security;
revoke all on public.crypto_deposits from anon, authenticated;
grant select on public.crypto_deposits to authenticated;
create policy crypto_deposits_select_own on public.crypto_deposits for select to authenticated using (user_id = auth.uid());
create policy crypto_deposits_select_admin on public.crypto_deposits for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy mfa_aal2_required on public.crypto_deposits as restrictive for all to authenticated
  using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()));

-- The deposit address a customer is shown and checked against. Today one address per network;
-- per-customer addresses only need this function (and the admin settings) to change.
create or replace function public.crypto_deposit_address_for(p_user uuid, p_network text)
returns text language sql stable security definer set search_path = public as $$
  select deposit_address from public.crypto_networks
  where id = p_network and deposit_enabled and deposit_address is not null
$$;

create or replace function public.crypto_deposit_submit(p_user uuid, p_network text, p_tx_hash text)
returns public.crypto_deposits
language plpgsql security definer set search_path = public as $$
declare
  v_net public.crypto_networks;
  v_address text;
  v_hash text := lower(regexp_replace(coalesce(p_tx_hash, ''), '^\s*(0x)?|\s+$', '', 'gi'));
  v_row public.crypto_deposits;
begin
  if (select account_type from public.profiles where id = p_user) is distinct from 'real' then
    raise exception 'real_account_only' using errcode = 'CM012';
  end if;
  select * into v_net from public.crypto_networks where id = p_network;
  v_address := public.crypto_deposit_address_for(p_user, p_network);
  if v_net.id is null or v_address is null then
    raise exception 'deposit_network_unavailable' using errcode = 'CM030';
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_tx_hash' using errcode = 'CM031';
  end if;
  if exists (select 1 from public.crypto_deposits where tx_hash = v_hash and status <> 'failed') then
    raise exception 'tx_already_submitted' using errcode = 'CM032';
  end if;
  if (select count(*) from public.crypto_deposits where user_id = p_user and status = 'pending') >= 5 then
    raise exception 'too_many_pending' using errcode = 'CM033';
  end if;
  if (select count(*) from public.crypto_deposits where user_id = p_user and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too_many_attempts' using errcode = 'CM034';
  end if;

  insert into public.crypto_deposits (user_id, network, tx_hash, deposit_address, required_confirmations)
  values (p_user, p_network, v_hash, v_address, v_net.confirmations)
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'tx_already_submitted' using errcode = 'CM032';
end $$;

-- Applies one on-chain check. p_result comes from the server verifier:
--   {"state":"found","amount":..,"confirmations":..,"from":..,"block":..}
--   {"state":"not_found"} | {"state":"failed","reason":"wrong_recipient|wrong_token|tx_failed"}
--   {"state":"error"}  (provider unavailable: try again later)
create or replace function public.crypto_deposit_record_check(p_id uuid, p_result jsonb)
returns public.crypto_deposits
language plpgsql security definer set search_path = public as $$
declare
  v_row public.crypto_deposits;
  v_min numeric;
  v_state text := p_result ->> 'state';
  v_amount numeric := nullif(p_result ->> 'amount', '')::numeric;
  v_conf integer := coalesce(nullif(p_result ->> 'confirmations', '')::integer, 0);
  v_attempts integer;
  v_type text;
  v_balance numeric;
  v_reason text;
begin
  select * into v_row from public.crypto_deposits where id = p_id for update;
  if v_row.id is null or v_row.status <> 'pending' then
    return v_row;
  end if;
  v_attempts := v_row.check_attempts + 1;

  if v_state = 'failed' then
    v_reason := p_result ->> 'reason';
    if v_reason not in ('wrong_recipient', 'wrong_token', 'tx_failed') then v_reason := 'tx_failed'; end if;
  elsif v_state = 'found' and v_amount is not null and v_amount > 0 then
    update public.crypto_deposits
      set amount = v_amount, confirmations = greatest(v_conf, 0), from_address = p_result ->> 'from',
          block_number = nullif(p_result ->> 'block', '')::bigint
      where id = p_id returning * into v_row;
    if v_conf >= v_row.required_confirmations then
      select min_deposit into v_min from public.crypto_networks where id = v_row.network;
      if v_amount < v_min then
        v_reason := 'below_minimum';
      else
        -- Credit the real wallet, wherever it sits right now (active or switched away).
        select account_type into v_type from public.profiles where id = v_row.user_id for update;
        if v_type = 'real' then
          update public.profiles set balance = balance + v_amount where id = v_row.user_id returning balance into v_balance;
        else
          update public.profiles set other_balance = other_balance + v_amount where id = v_row.user_id returning other_balance into v_balance;
        end if;
        insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
        values (v_row.user_id, 'deposit', v_amount, v_balance, 'crypto_deposit:' || v_row.id, 'real');
        update public.crypto_deposits
          set status = 'completed', completed_at = now(), check_attempts = v_attempts, last_checked_at = now()
          where id = p_id returning * into v_row;
        insert into public.notifications (user_id, type, title, body, data)
        values (v_row.user_id, 'wallet_deposit_approved', 'Deposit completed',
          'Your deposit of ' || v_amount || ' USDT is complete.',
          jsonb_build_object('amount', v_amount, 'network', v_row.network));
        return v_row;
      end if;
    end if;
  elsif v_state = 'not_found' and now() - v_row.created_at > interval '1 hour' then
    v_reason := 'not_found';
  end if;

  if v_reason is null and v_attempts >= 150 then
    v_reason := 'expired';
  end if;

  if v_reason is not null then
    update public.crypto_deposits
      set status = 'failed', failure_reason = v_reason, check_attempts = v_attempts, last_checked_at = now()
      where id = p_id returning * into v_row;
    insert into public.notifications (user_id, type, title, body, data)
    values (v_row.user_id, 'wallet_deposit_failed', 'Deposit failed', 'Your deposit could not be credited.',
      jsonb_build_object('reason', v_reason, 'network', v_row.network));
    return v_row;
  end if;

  -- Still waiting: check again soon at first, then less often.
  update public.crypto_deposits
    set check_attempts = v_attempts, last_checked_at = now(),
        next_check_at = now() + case when v_attempts < 20 then interval '30 seconds'
                                     when v_attempts < 60 then interval '1 minute'
                                     else interval '5 minutes' end
    where id = p_id returning * into v_row;
  return v_row;
end $$;

-- Security events (password / 2FA changes lock withdrawals for 24 hours) -------------------------
create table public.account_security_events (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_changed_at timestamptz,
  mfa_changed_at timestamptz
);
alter table public.account_security_events enable row level security;
revoke all on public.account_security_events from anon, authenticated;
grant select on public.account_security_events to authenticated;
create policy account_security_events_select_own on public.account_security_events
  for select to authenticated using (user_id = auth.uid());

create or replace function public.track_password_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    insert into public.account_security_events (user_id, password_changed_at) values (new.id, now())
    on conflict (user_id) do update set password_changed_at = now();
  end if;
  return new;
end $$;
drop trigger if exists trg_track_password_change on auth.users;
create trigger trg_track_password_change after update of encrypted_password on auth.users
  for each row execute function public.track_password_change();

create or replace function public.track_mfa_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if (tg_op = 'INSERT' and new.status = 'verified')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and (new.status = 'verified' or old.status = 'verified'))
     or (tg_op = 'DELETE' and old.status = 'verified') then
    v_user := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    insert into public.account_security_events (user_id, mfa_changed_at) values (v_user, now())
    on conflict (user_id) do update set mfa_changed_at = now();
  end if;
  return null;
end $$;
drop trigger if exists trg_track_mfa_change on auth.mfa_factors;
create trigger trg_track_mfa_change after insert or update of status or delete on auth.mfa_factors
  for each row execute function public.track_mfa_change();

create or replace function public.withdraw_locked_until(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(password_changed_at, mfa_changed_at) + interval '24 hours'
  from public.account_security_events where user_id = p_user
$$;

-- 2FA for withdrawals: a verified authenticator, an aal2 session and a code entered in the last
-- 5 minutes (the JWT's amr carries the time of the last TOTP verification).
create or replace function public.withdraw_mfa_check()
returns void language plpgsql stable security definer set search_path = public as $$
declare v_totp_at bigint;
begin
  if not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and factor_type = 'totp' and status = 'verified') then
    raise exception 'mfa_not_enabled' using errcode = 'CM040';
  end if;
  select max((e ->> 'timestamp')::bigint) into v_totp_at
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
    where e ->> 'method' = 'totp';
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' or v_totp_at is null
     or to_timestamp(v_totp_at) < now() - interval '5 minutes' then
    raise exception 'mfa_code_required' using errcode = 'CM041';
  end if;
end $$;

-- Withdrawals -----------------------------------------------------------------------------------
create table public.crypto_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  network text not null references public.crypto_networks (id),
  address text not null,
  amount numeric not null check (amount > 0),
  fee numeric not null check (fee >= 0),
  net_amount numeric not null check (net_amount > 0),
  status text not null default 'processing' check (status in ('processing', 'sending', 'completed', 'rejected', 'cancelled')),
  tx_hash text check (tx_hash is null or tx_hash ~ '^[0-9a-f]{64}$'),
  reject_reason text,
  processed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint crypto_withdrawals_net check (net_amount = amount - fee),
  constraint crypto_withdrawals_completed_tx check (status <> 'completed' or tx_hash is not null)
);
create unique index crypto_withdrawals_tx_hash on public.crypto_withdrawals (tx_hash) where tx_hash is not null;
create index crypto_withdrawals_user on public.crypto_withdrawals (user_id, created_at desc);
create index crypto_withdrawals_open on public.crypto_withdrawals (created_at) where status in ('processing', 'sending');

alter table public.crypto_withdrawals enable row level security;
revoke all on public.crypto_withdrawals from anon, authenticated;
grant select on public.crypto_withdrawals to authenticated;
create policy crypto_withdrawals_select_own on public.crypto_withdrawals for select to authenticated using (user_id = auth.uid());
create policy crypto_withdrawals_select_admin on public.crypto_withdrawals for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy mfa_aal2_required on public.crypto_withdrawals as restrictive for all to authenticated
  using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()));

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type = any (array['deposit', 'withdrawal', 'withdrawal_refund', 'pnl', 'fee', 'admin_adjustment', 'demo_reset']));

-- Amount withdrawn in the last 24 hours on one network (frozen, sending or completed).
create or replace function public.crypto_withdrawn_24h(p_user uuid, p_network text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.crypto_withdrawals
  where user_id = p_user and network = p_network and status in ('processing', 'sending', 'completed')
    and created_at > now() - interval '24 hours'
$$;

create or replace function public.request_crypto_withdrawal(p_network text, p_address text, p_amount numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_net public.crypto_networks;
  v_type text;
  v_balance numeric;
  v_reserved numeric;
  v_address text := btrim(coalesce(p_address, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform public.withdraw_mfa_check();

  -- One request at a time per customer: the daily limit and balance checks below stay exact.
  select account_type, balance into v_type, v_balance from public.profiles where id = v_uid for update;
  if v_type is distinct from 'real' then
    raise exception 'real_account_only' using errcode = 'CM012';
  end if;
  if public.withdraw_locked_until(v_uid) > now() then
    raise exception 'withdraw_security_lock' using errcode = 'CM042';
  end if;
  if not public.kyc_is_approved(v_uid) then
    raise exception 'kyc_required' using errcode = 'CM024';
  end if;
  if exists (select 1 from public.simulated_positions where follower_id = v_uid and status = 'open') then
    raise exception 'withdraw_locked_open_positions' using errcode = 'CM023';
  end if;

  select * into v_net from public.crypto_networks where id = p_network;
  if v_net.id is null or not v_net.withdraw_enabled then
    raise exception 'withdraw_network_unavailable' using errcode = 'CM043';
  end if;
  if not public.crypto_address_valid(p_network, v_address)
     or lower(v_address) = lower(coalesce(v_net.deposit_address, '')) then
    raise exception 'invalid_address' using errcode = 'CM044';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 6) then
    raise exception 'invalid_amount' using errcode = 'CM001';
  end if;
  if p_amount < v_net.min_withdraw or p_amount <= v_net.withdraw_fee then
    raise exception 'below_min_withdraw' using errcode = 'CM045';
  end if;
  if public.crypto_withdrawn_24h(v_uid, p_network) + p_amount > v_net.daily_withdraw_limit then
    raise exception 'daily_limit' using errcode = 'CM046';
  end if;

  select coalesce(sum(allocated_amount), 0) into v_reserved
    from public.subscriptions where follower_id = v_uid and is_active = true;
  if p_amount > v_balance - v_reserved then
    raise exception 'exceeds_balance' using errcode = 'CM006';
  end if;

  update public.profiles set balance = balance - p_amount where id = v_uid returning balance into v_balance;
  insert into public.crypto_withdrawals (user_id, network, address, amount, fee, net_amount)
  values (v_uid, p_network, v_address, p_amount, v_net.withdraw_fee, p_amount - v_net.withdraw_fee)
  returning id into v_id;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (v_uid, 'withdrawal', -p_amount, v_balance, 'crypto_withdrawal:' || v_id, 'real');
  return v_id;
end $$;

-- Gives a frozen withdrawal back to the real wallet (active or switched away).
create or replace function public.crypto_withdrawal_refund(p_row public.crypto_withdrawals)
returns void language plpgsql security definer set search_path = public as $$
declare v_type text; v_balance numeric;
begin
  select account_type into v_type from public.profiles where id = p_row.user_id for update;
  if v_type = 'real' then
    update public.profiles set balance = balance + p_row.amount where id = p_row.user_id returning balance into v_balance;
  else
    update public.profiles set other_balance = other_balance + p_row.amount where id = p_row.user_id returning other_balance into v_balance;
  end if;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (p_row.user_id, 'withdrawal_refund', p_row.amount, v_balance, 'crypto_withdrawal:' || p_row.id, 'real');
end $$;

create or replace function public.cancel_crypto_withdrawal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.crypto_withdrawals;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_row from public.crypto_withdrawals where id = p_id and user_id = auth.uid() for update;
  if v_row.id is null or v_row.status <> 'processing' then
    raise exception 'withdraw_not_cancellable' using errcode = 'CM047';
  end if;
  update public.crypto_withdrawals set status = 'cancelled', updated_at = now() where id = p_id;
  perform public.crypto_withdrawal_refund(v_row);
end $$;

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
end $$;

create or replace function public.admin_crypto_withdrawal_start(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.crypto_withdrawals set status = 'sending', processed_by = auth.uid(), updated_at = now()
    where id = p_id and status = 'processing';
  if not found then raise exception 'withdraw_wrong_status' using errcode = 'CM048'; end if;
end $$;

create or replace function public.admin_crypto_withdrawal_complete(p_id uuid, p_tx_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.crypto_withdrawals;
  v_hash text := lower(regexp_replace(coalesce(p_tx_hash, ''), '^\s*(0x)?|\s+$', '', 'gi'));
begin
  perform public.assert_admin();
  if v_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_tx_hash' using errcode = 'CM031'; end if;
  select * into v_row from public.crypto_withdrawals where id = p_id for update;
  if v_row.id is null or v_row.status <> 'sending' then
    raise exception 'withdraw_wrong_status' using errcode = 'CM048';
  end if;
  if exists (select 1 from public.crypto_withdrawals where tx_hash = v_hash)
     or exists (select 1 from public.crypto_deposits where tx_hash = v_hash and status <> 'failed') then
    raise exception 'tx_already_used' using errcode = 'CM032';
  end if;
  update public.crypto_withdrawals
    set status = 'completed', tx_hash = v_hash, completed_at = now(), updated_at = now(), processed_by = auth.uid()
    where id = p_id;
  insert into public.notifications (user_id, type, title, body, data)
  values (v_row.user_id, 'wallet_withdrawal_approved', 'Withdrawal completed',
    'Your withdrawal of ' || v_row.net_amount || ' USDT is complete.',
    jsonb_build_object('amount', v_row.net_amount, 'network', v_row.network));
end $$;

create or replace function public.admin_crypto_withdrawal_reject(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.crypto_withdrawals;
begin
  perform public.assert_admin();
  select * into v_row from public.crypto_withdrawals where id = p_id for update;
  if v_row.id is null or v_row.status not in ('processing', 'sending') then
    raise exception 'withdraw_wrong_status' using errcode = 'CM048';
  end if;
  update public.crypto_withdrawals
    set status = 'rejected', reject_reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now(), processed_by = auth.uid()
    where id = p_id;
  perform public.crypto_withdrawal_refund(v_row);
  insert into public.notifications (user_id, type, title, body, data)
  values (v_row.user_id, 'wallet_withdrawal_rejected', 'Withdrawal rejected',
    'Your withdrawal request could not be completed. The amount is back in your balance.',
    jsonb_build_object('amount', v_row.amount, 'network', v_row.network));
end $$;

create or replace function public.admin_update_crypto_network(
  p_id text, p_deposit_address text, p_min_deposit numeric, p_confirmations integer,
  p_withdraw_fee numeric, p_min_withdraw numeric, p_daily_withdraw_limit numeric,
  p_deposit_enabled boolean, p_withdraw_enabled boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.crypto_networks set
    deposit_address = nullif(btrim(coalesce(p_deposit_address, '')), ''),
    min_deposit = p_min_deposit, confirmations = p_confirmations, withdraw_fee = p_withdraw_fee,
    min_withdraw = p_min_withdraw, daily_withdraw_limit = p_daily_withdraw_limit,
    deposit_enabled = p_deposit_enabled, withdraw_enabled = p_withdraw_enabled,
    updated_at = now(), updated_by = auth.uid()
  where id = p_id;
  if not found then raise exception 'network_not_found' using errcode = 'CM049'; end if;
end $$;

-- Back-office "check again now" for a pending deposit.
create or replace function public.admin_crypto_deposit_recheck(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.crypto_deposits set next_check_at = now() where id = p_id and status = 'pending';
end $$;

-- Grants: server-only functions run with the service role key; customer / admin functions with
-- the signed-in session.
do $$
declare f text;
begin
  foreach f in array array[
    'public.crypto_address_valid(text, text)', 'public.crypto_deposit_address_for(uuid, text)',
    'public.crypto_deposit_submit(uuid, text, text)', 'public.crypto_deposit_record_check(uuid, jsonb)',
    'public.track_password_change()', 'public.track_mfa_change()', 'public.withdraw_locked_until(uuid)',
    'public.withdraw_mfa_check()', 'public.crypto_withdrawn_24h(uuid, text)',
    'public.crypto_withdrawal_refund(public.crypto_withdrawals)', 'public.assert_admin()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.crypto_deposit_address_for(uuid, text)', 'public.crypto_deposit_submit(uuid, text, text)',
    'public.crypto_deposit_record_check(uuid, jsonb)', 'public.withdraw_locked_until(uuid)',
    'public.crypto_withdrawn_24h(uuid, text)'
  ] loop
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array[
    'public.request_crypto_withdrawal(text, text, numeric)', 'public.cancel_crypto_withdrawal(uuid)',
    'public.admin_crypto_withdrawal_start(uuid)', 'public.admin_crypto_withdrawal_complete(uuid, text)',
    'public.admin_crypto_withdrawal_reject(uuid, text)',
    'public.admin_update_crypto_network(text, text, numeric, integer, numeric, numeric, numeric, boolean, boolean)',
    'public.admin_crypto_deposit_recheck(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Retire manual wallet requests: history stays readable, no new requests.
drop policy if exists wallet_requests_insert_own on public.wallet_requests;
revoke insert on public.wallet_requests from authenticated;

-- Re-check pending deposits every minute. The server route needs its URL and secret, read from
-- Supabase Vault (names: crypto_cron_url, crypto_cron_secret); without them this does nothing.
create or replace function public.fire_crypto_deposit_checks()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.crypto_deposits where status = 'pending' and next_check_at <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'crypto_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'crypto_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_get(url := v_url, headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000);
end $$;
revoke all on function public.fire_crypto_deposit_checks() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'crypto-deposit-checks';
select cron.schedule('crypto-deposit-checks', '* * * * *', $$select public.fire_crypto_deposit_checks();$$);

commit;
