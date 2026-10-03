-- Demo and real wallets are fully separate.
--
-- profiles.balance stays the balance of the ACTIVE account (account_type), so
-- the trading engine is untouched. profiles.other_balance holds the wallet of
-- the INACTIVE account type. switch_account_type() swaps them atomically; it is
-- the only way the two ever move, and no function converts money between them.
--
--  * Every new profile starts with 10,000 USDT of demo money (plus a 0 real wallet).
--  * Demo deposit / withdraw / reset are instant server functions that only
--    touch the demo wallet and are capped at demo_max_balance().
--  * Real deposits/withdrawals stay wallet_requests; approval only ever
--    credits/debits the real wallet, wherever it currently sits.

begin;

alter table public.profiles add column if not exists other_balance numeric not null default 0;
alter table public.profiles alter column balance set default 10000;

-- Backfill: real-type profiles keep their balance and gain a 10,000 demo wallet;
-- demo-type profiles with an empty demo wallet get 10,000.
update public.profiles set other_balance = 10000 where account_type = 'real' and other_balance = 0;
update public.profiles set balance = 10000 where account_type = 'demo' and balance <= 0;

-- Which wallet a ledger row belongs to ---------------------------------------
alter table public.wallet_requests add column if not exists account_type text;
alter table public.wallet_transactions add column if not exists account_type text;
update public.wallet_requests set account_type = 'real' where account_type is null;
update public.wallet_transactions t
  set account_type = coalesce((select p.account_type from public.profiles p where p.id = t.user_id), 'demo')
  where account_type is null;
alter table public.wallet_requests alter column account_type set default 'real';
alter table public.wallet_requests alter column account_type set not null;
alter table public.wallet_requests drop constraint if exists wallet_requests_account_type_check;
alter table public.wallet_requests add constraint wallet_requests_account_type_check check (account_type = 'real');
alter table public.wallet_transactions drop constraint if exists wallet_transactions_account_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_account_type_check check (account_type in ('demo', 'real'));

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type = any (array['deposit', 'withdrawal', 'pnl', 'fee', 'admin_adjustment', 'demo_reset']));

create or replace function public.wallet_transactions_set_account_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_type is null then
    select account_type into new.account_type from public.profiles where id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_wallet_transactions_account_type on public.wallet_transactions;
create trigger trg_wallet_transactions_account_type before insert on public.wallet_transactions
  for each row execute function public.wallet_transactions_set_account_type();
alter table public.wallet_transactions alter column account_type set not null;

-- Real requests only exist for real accounts; demo money never goes through them.
create or replace function public.wallet_requests_real_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select account_type from public.profiles where id = new.user_id) <> 'real' then
    raise exception 'demo_account_no_requests' using errcode = 'CM012';
  end if;
  new.account_type := 'real';
  return new;
end $$;
drop trigger if exists trg_wallet_requests_real_only on public.wallet_requests;
create trigger trg_wallet_requests_real_only before insert on public.wallet_requests
  for each row execute function public.wallet_requests_real_only();

-- New users -------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text := case when coalesce(new.raw_user_meta_data ->> 'account_type', 'demo') = 'real' then 'real' else 'demo' end;
begin
  insert into public.profiles (id, display_name, email, account_type, phone, balance, other_balance)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    v_type,
    new.raw_user_meta_data ->> 'phone',
    case when v_type = 'demo' then 10000 else 0 end,
    case when v_type = 'demo' then 0 else 10000 end
  );
  return new;
end $$;

-- Switching accounts ------------------------------------------------------------
create or replace function public.switch_account_type(p_type text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cur text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_type not in ('demo', 'real') then raise exception 'invalid_account_type' using errcode = 'CM013'; end if;

  select account_type into v_cur from public.profiles where id = auth.uid() for update;
  if v_cur is null or v_cur = p_type then return; end if;

  if exists (select 1 from public.simulated_positions where follower_id = auth.uid() and status = 'open') then
    raise exception 'open_positions' using errcode = 'CM010';
  end if;

  update public.subscriptions set is_active = false where follower_id = auth.uid() and is_active = true;
  update public.profiles
    set account_type = p_type, balance = other_balance, other_balance = balance
    where id = auth.uid();
end $$;

-- Demo wallet --------------------------------------------------------------------
create or replace function public.demo_max_balance() returns numeric language sql immutable as $$ select 1000000::numeric $$;

create or replace function public.demo_deposit(p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_type text; v_balance numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'CM001'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  if v_balance + p_amount > public.demo_max_balance() then raise exception 'demo_limit' using errcode = 'CM011'; end if;
  update public.profiles set balance = balance + p_amount where id = auth.uid() returning balance into v_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'deposit', p_amount, v_balance, 'demo_deposit', 'demo');
  return v_balance;
end $$;

create or replace function public.demo_withdraw(p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_type text; v_balance numeric; v_reserved numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'CM001'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  select coalesce(sum(allocated_amount), 0) into v_reserved
    from public.subscriptions where follower_id = auth.uid() and is_active = true;
  if p_amount > v_balance - v_reserved then raise exception 'exceeds_balance' using errcode = 'CM006'; end if;
  update public.profiles set balance = balance - p_amount where id = auth.uid() returning balance into v_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'withdrawal', -p_amount, v_balance, 'demo_withdrawal', 'demo');
  return v_balance;
end $$;

create or replace function public.reset_demo_balance()
returns numeric language plpgsql security definer set search_path = public as $$
declare v_type text; v_balance numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  if exists (select 1 from public.simulated_positions where follower_id = auth.uid() and status = 'open') then
    raise exception 'open_positions' using errcode = 'CM010';
  end if;
  update public.subscriptions set is_active = false where follower_id = auth.uid() and is_active = true;
  update public.profiles set balance = 10000 where id = auth.uid();
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'demo_reset', 10000 - v_balance, 10000, 'demo_reset', 'demo');
  return 10000;
end $$;

-- Real-wallet approvals ---------------------------------------------------------
create or replace function public.apply_wallet_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_balance numeric;
  v_reserved numeric;
begin
  if new.status = 'approved' and old.status = 'pending' then
    select account_type into v_type from public.profiles where id = new.user_id for update;

    if new.type = 'withdrawal' then
      if v_type = 'real' then
        if exists (select 1 from public.simulated_positions where follower_id = new.user_id and status = 'open')
           or exists (select 1 from public.subscriptions where follower_id = new.user_id and is_active = true
                      and now() - copy_started_at >= interval '10 minutes') then
          raise exception 'Withdrawal unavailable while positions are open. Close them and submit the request again.';
        end if;
        select balance into v_balance from public.profiles where id = new.user_id;
        select coalesce(sum(allocated_amount), 0) into v_reserved
          from public.subscriptions where follower_id = new.user_id and is_active = true;
        v_balance := v_balance - v_reserved;
      else
        select other_balance into v_balance from public.profiles where id = new.user_id;
      end if;
      if v_balance < new.amount then
        raise exception 'Insufficient available balance.';
      end if;
      if v_type = 'real' then
        update public.profiles set balance = balance - new.amount where id = new.user_id returning balance into v_balance;
      else
        update public.profiles set other_balance = other_balance - new.amount where id = new.user_id returning other_balance into v_balance;
      end if;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
      values (new.user_id, 'withdrawal', -new.amount, v_balance, 'withdrawal_completed', 'real');
    else
      if v_type = 'real' then
        update public.profiles set balance = balance + new.amount where id = new.user_id returning balance into v_balance;
      else
        update public.profiles set other_balance = other_balance + new.amount where id = new.user_id returning other_balance into v_balance;
      end if;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
      values (new.user_id, 'deposit', new.amount, v_balance, 'deposit_completed', 'real');
    end if;

    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body, data)
    values (new.user_id, 'wallet_' || new.type || '_approved',
      case when new.type = 'deposit' then 'Deposit completed' else 'Withdrawal completed' end,
      'Your ' || new.type || ' of ' || new.amount || ' USDT is complete.',
      jsonb_build_object('amount', new.amount));
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.reviewed_at := now();
    insert into public.notifications (user_id, type, title, body, data)
    values (new.user_id, 'wallet_' || new.type || '_rejected',
      case when new.type = 'deposit' then 'Deposit rejected' else 'Withdrawal rejected' end,
      'Your ' || new.type || ' request could not be completed. Contact support for details.',
      '{}'::jsonb);
  end if;
  return new;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.switch_account_type(text)', 'public.demo_deposit(numeric)',
    'public.demo_withdraw(numeric)', 'public.reset_demo_balance()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;
