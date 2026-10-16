-- 0270: account hardening
--
--  * profiles.email_verified_at: an address is verified once the customer opens the link we send (or
--    signs in with Google, which verifies it). Real deposits and withdrawals need it (CM071).
--    Accounts that exist today are marked verified at their creation (they signed up when the
--    platform confirmed addresses at sign-up); every new account has to verify.
--  * the e-mail is stored trimmed and lowercase and is unique that way; the phone number is E.164
--    (+ and 7 to 15 digits) and unique. Phone numbers shared by several accounts (test accounts)
--    stay on the oldest account; the others are kept in profiles_phone_backup_0270 and cleared.
--  * balances can never go below zero (check constraint). A copy that loses more than the wallet
--    holds takes the wallet to zero (negative balance protection) instead of failing to close.
--  * demo deposits / withdrawals: at least 1, at most two decimals.
--  * rate_limit_blocked / rate_limit_record: failed-attempt limits by key (an e-mail, not only an IP).
--  * idempotency keys: claim_idempotency_key / release_idempotency_key, so a button pressed twice
--    does the work once.
--  * set_my_phone(): the one way a customer sets a phone number (validated, unique).
-- Rollback: supabase/rollback/0270_account_hardening.sql

begin;

alter table public.profiles add column if not exists email_verified_at timestamptz;
update public.profiles set email_verified_at = created_at where email_verified_at is null;

create table if not exists public.profiles_phone_backup_0270 (id uuid primary key, phone text not null);
alter table public.profiles_phone_backup_0270 enable row level security;
revoke all on public.profiles_phone_backup_0270 from anon, authenticated;
with ranked as (
  select id, phone, row_number() over (partition by phone order by created_at, id) rn
  from public.profiles where phone is not null
)
insert into public.profiles_phone_backup_0270 (id, phone) select id, phone from ranked where rn > 1
on conflict do nothing;
update public.profiles p set phone = null from public.profiles_phone_backup_0270 b where b.id = p.id;

update public.profiles set email = lower(btrim(email)) where email is not null and email <> lower(btrim(email));
alter table public.profiles drop constraint if exists profiles_phone_e164;
alter table public.profiles add constraint profiles_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;
create unique index if not exists profiles_email_unique on public.profiles (lower(btrim(email))) where email is not null;
alter table public.profiles drop constraint if exists profiles_balances_nonneg;
alter table public.profiles add constraint profiles_balances_nonneg check (balance >= 0 and other_balance >= 0);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_type text := case when coalesce(new.raw_user_meta_data ->> 'account_type', 'demo') = 'real' then 'real' else 'demo' end;
  -- an address the identity provider itself has verified (Google) counts as verified
  v_verified boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google'
                        and coalesce(new.raw_user_meta_data ->> 'email_verified', 'false') = 'true';
begin
  -- The phone number is never taken from sign-up metadata: it is added later from the account page
  -- (set_my_phone), validated and unique.
  insert into public.profiles (id, display_name, email, account_type, phone, balance, other_balance, email_verified_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    lower(btrim(new.email)),
    v_type,
    null,
    case when v_type = 'demo' then 10000 else 0 end,
    case when v_type = 'demo' then 0 else 10000 end,
    case when v_verified then now() end
  );
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.settle_copied_position(p_position_id uuid, p_exit_price numeric, p_closed_at timestamp with time zone, p_reason text DEFAULT 'leader'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_position record;
  v_signal record;
  v_pnl numeric;
  v_follower_balance numeric;
  v_balance_before numeric;
  v_sub record;
  v_cumulative_pnl numeric;
  v_provider_name text;
begin
  select * into v_position from public.simulated_positions where id = p_position_id and status = 'open' for update;
  if not found then
    raise exception 'position_not_found_or_closed' using errcode = 'CM010';
  end if;

  select s.symbol, s.side, s.provider_id into v_signal from public.signals s where s.id = v_position.signal_id;

  select coalesce(pr.display_name, p.display_name) into v_provider_name
  from public.providers p
  left join public.profiles pr on pr.id = p.user_id
  where p.id = v_signal.provider_id;

  v_pnl := public.trade_position_pnl(v_signal.side, v_position.entry_price, p_exit_price, v_position.size);

  update public.simulated_positions
  set exit_price = p_exit_price,
      status = 'closed',
      closed_at = p_closed_at,
      pnl = v_pnl
  where id = v_position.id;

  select balance into v_balance_before from public.profiles where id = v_position.follower_id for update;
  update public.profiles
  set balance = greatest(0, balance + v_pnl)
  where id = v_position.follower_id
  returning balance into v_follower_balance;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
  values (
    v_position.follower_id, 'pnl', v_follower_balance - v_balance_before, v_follower_balance,
    case when p_reason = 'manual' then 'إغلاق يدوي لصفقة منسوخة: ' else 'نتيجة صفقة منسوخة: ' end || v_signal.symbol
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_position.follower_id,
    'copy_closed',
    'صفقة منسوخة من ' || coalesce(v_provider_name, 'متداول'),
    'أُغلقت صفقة ' || v_signal.symbol || ' بنتيجة ' ||
      (case when v_pnl >= 0 then '+' else '' end) || round(v_pnl, 2) || '$',
    jsonb_build_object(
      'providerName', coalesce(v_provider_name, 'متداول'),
      'symbol', v_signal.symbol,
      'amount', round(abs(v_pnl), 2),
      'positive', v_pnl >= 0,
      'reason', coalesce(p_reason, 'leader')
    )
  );

  select id, allocated_amount, max_drawdown_pct, is_active into v_sub
  from public.subscriptions where id = v_position.subscription_id;

  if v_sub.is_active then
    select coalesce(sum(pnl), 0) into v_cumulative_pnl
    from public.simulated_positions
    where subscription_id = v_sub.id and status = 'closed';

    if v_cumulative_pnl <= -(v_sub.allocated_amount * v_sub.max_drawdown_pct / 100) then
      update public.subscriptions set is_active = false where id = v_sub.id;

      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_position.follower_id,
        'auto_stop_copy',
        'تم إيقاف النسخ تلقائيًا',
        'تم إيقاف متابعة أحد المتداولين تلقائيًا بعد تجاوز حد الخسارة المسموح به (' ||
          v_sub.max_drawdown_pct || '%). يمكنك متابعته مجددًا في أي وقت من صفحة اكتشاف المتداولين.',
        jsonb_build_object('maxDrawdownPct', v_sub.max_drawdown_pct)
      );
    end if;
  end if;

  return v_pnl;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_crypto_withdrawal(p_network text, p_address text, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not exists (select 1 from public.profiles where id = v_uid and email_verified_at is not null) then
    raise exception 'email_unverified' using errcode = 'CM071';
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
end $function$;

CREATE OR REPLACE FUNCTION public.crypto_deposit_submit(p_user uuid, p_network text, p_tx_hash text)
 RETURNS crypto_deposits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_net public.crypto_networks;
  v_address text;
  v_hash text := lower(regexp_replace(coalesce(p_tx_hash, ''), '^\s*(0x)?|\s+$', '', 'gi'));
  v_row public.crypto_deposits;
begin
  if not public.deposits_enabled() then
    raise exception 'deposits_disabled' using errcode = 'CM035';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and email_verified_at is not null) then
    raise exception 'email_unverified' using errcode = 'CM071';
  end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.demo_deposit(p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_type text; v_balance numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 or p_amount <> round(p_amount, 2) then raise exception 'invalid_amount' using errcode = 'CM001'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  if v_balance + p_amount > public.demo_max_balance() then raise exception 'demo_limit' using errcode = 'CM011'; end if;
  update public.profiles set balance = balance + p_amount where id = auth.uid() returning balance into v_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'deposit', p_amount, v_balance, 'demo_deposit', 'demo');
  return v_balance;
end $function$;

CREATE OR REPLACE FUNCTION public.demo_withdraw(p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_type text; v_balance numeric; v_reserved numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 or p_amount <> round(p_amount, 2) then raise exception 'invalid_amount' using errcode = 'CM001'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  if exists (select 1 from public.simulated_positions where follower_id = auth.uid() and status = 'open') then
    raise exception 'withdraw_locked_open_positions' using errcode = 'CM023';
  end if;
  select coalesce(sum(allocated_amount), 0) into v_reserved
    from public.subscriptions where follower_id = auth.uid() and is_active = true;
  if p_amount > v_balance - v_reserved then raise exception 'exceeds_balance' using errcode = 'CM006'; end if;
  update public.profiles set balance = balance - p_amount where id = auth.uid() returning balance into v_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'withdrawal', -p_amount, v_balance, 'demo_withdrawal', 'demo');
  return v_balance;
end $function$;

create or replace function public.set_my_phone(p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := btrim(coalesce(p_phone, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'invalid_phone' using errcode = 'CM072'; end if;
  begin
    update public.profiles set phone = v where id = auth.uid();
  exception when unique_violation then
    raise exception 'phone_taken' using errcode = 'CM073';
  end;
end $$;
revoke all on function public.set_my_phone(text) from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;

-- failed-attempt limits (service role only): blocked when the key already has p_max records inside the window
create or replace function public.rate_limit_blocked(p_key text, p_max integer, p_window_seconds integer)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= p_max from public.rate_limits where key = p_key and created_at >= now() - make_interval(secs => p_window_seconds)
$$;
create or replace function public.rate_limit_record(p_key text)
returns void language sql security definer set search_path = public as $$
  insert into public.rate_limits (key) values (p_key)
$$;
create or replace function public.rate_limit_clear(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where key = p_key
$$;
revoke all on function public.rate_limit_blocked(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_record(text) from public, anon, authenticated;
revoke all on function public.rate_limit_clear(text) from public, anon, authenticated;

create table if not exists public.idempotency_keys (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon, authenticated;

create or replace function public.claim_idempotency_key(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_key is null or length(p_key) not between 8 and 100 then return true; end if;
  delete from public.idempotency_keys where user_id = auth.uid() and created_at < now() - interval '1 day';
  insert into public.idempotency_keys (user_id, key) values (auth.uid(), p_key) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
create or replace function public.release_idempotency_key(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.idempotency_keys where user_id = auth.uid() and key = p_key
$$;
revoke all on function public.claim_idempotency_key(text), public.release_idempotency_key(text) from public, anon;
grant execute on function public.claim_idempotency_key(text), public.release_idempotency_key(text) to authenticated;

commit;
