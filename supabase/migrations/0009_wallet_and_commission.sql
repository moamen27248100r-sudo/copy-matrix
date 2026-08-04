-- ============================================================
-- Copy Matrix — wallet balance, deposit/withdraw ledger, real
-- dollar copy-allocation per subscription, and provider
-- performance-fee commission on profitable copied positions.
-- ============================================================

alter table public.profiles add column balance numeric not null default 10000;
alter table public.subscriptions add column allocated_amount numeric not null default 100 check (allocated_amount > 0);
alter table public.providers add column commission_pct numeric not null default 20 check (commission_pct >= 0 and commission_pct <= 100);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'pnl', 'fee')),
  amount numeric not null,
  balance_after numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.wallet_transactions enable row level security;

-- Rows are only ever written by the RPC/trigger functions below
-- (security definer), never directly by a user — same pattern as
-- simulated_positions, so no one can fake a balance change.
create policy "wallet_transactions_select_own" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());

-- ---------- Deposit / withdraw ----------

create function public.deposit_funds(p_amount numeric, p_note text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'المبلغ يجب أن يكون أكبر من صفر';
  end if;

  update public.profiles set balance = balance + p_amount where id = auth.uid()
  returning balance into v_new_balance;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
  values (auth.uid(), 'deposit', p_amount, v_new_balance, p_note);

  return v_new_balance;
end;
$$;

create function public.withdraw_funds(p_amount numeric, p_note text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'المبلغ يجب أن يكون أكبر من صفر';
  end if;

  select balance into v_balance from public.profiles where id = auth.uid();

  if v_balance < p_amount then
    raise exception 'الرصيد غير كافٍ لإتمام عملية السحب';
  end if;

  update public.profiles set balance = balance - p_amount where id = auth.uid()
  returning balance into v_new_balance;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
  values (auth.uid(), 'withdrawal', -p_amount, v_new_balance, p_note);

  return v_new_balance;
end;
$$;

-- ---------- Re-point the copy-mirroring triggers at real dollars ----------

-- A copied position's size is now the follower's dollar allocation at
-- the moment the signal opened (snapshotted from the subscription),
-- not an abstract multiplier.
create or replace function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
  select new.id, sub.id, sub.follower_id, new.entry_price, sub.allocated_amount
  from public.subscriptions sub
  where sub.provider_id = new.provider_id
    and sub.is_active = true;
  return new;
end;
$$;

-- Closing a signal now settles real P&L (percentage return applied to
-- the dollar allocation) into the follower's balance, charges the
-- provider's performance fee out of any profit, and records both
-- movements in the wallet ledger. Providers without their own login
-- account (platform-curated leaders) simply have no wallet to credit.
create or replace function public.close_simulated_positions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position record;
  v_pnl numeric;
  v_fee numeric;
  v_commission_pct numeric;
  v_provider_user_id uuid;
  v_follower_balance numeric;
  v_provider_balance numeric;
begin
  if new.status = 'closed' and old.status = 'open' then
    select commission_pct, user_id into v_commission_pct, v_provider_user_id
    from public.providers where id = new.provider_id;

    for v_position in
      select * from public.simulated_positions
      where signal_id = new.id and status = 'open'
    loop
      v_pnl := ((new.exit_price - v_position.entry_price) / v_position.entry_price)
               * v_position.size
               * (case when new.side = 'sell' then -1 else 1 end);
      v_fee := case when v_pnl > 0 then round(v_pnl * coalesce(v_commission_pct, 0) / 100, 2) else 0 end;

      update public.simulated_positions
      set exit_price = new.exit_price,
          status = 'closed',
          closed_at = now(),
          pnl = v_pnl - v_fee
      where id = v_position.id;

      update public.profiles
      set balance = balance + (v_pnl - v_fee)
      where id = v_position.follower_id
      returning balance into v_follower_balance;

      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (
        v_position.follower_id, 'pnl', v_pnl - v_fee, v_follower_balance,
        'نتيجة صفقة منسوخة: ' || new.symbol
      );

      if v_fee > 0 and v_provider_user_id is not null then
        update public.profiles
        set balance = balance + v_fee
        where id = v_provider_user_id
        returning balance into v_provider_balance;

        insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
        values (
          v_provider_user_id, 'fee', v_fee, v_provider_balance,
          'عمولة أداء من صفقة: ' || new.symbol
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;
