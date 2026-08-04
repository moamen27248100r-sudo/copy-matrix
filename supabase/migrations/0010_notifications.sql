-- ============================================================
-- Copy Matrix — in-app notification center. Rows are only ever
-- written by security-definer trigger functions, never directly
-- by a user; users may only mark their own notifications as read.
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- Notify followers when a copied position opens ----------

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

  insert into public.notifications (user_id, type, title, body)
  select
    sub.follower_id,
    'copy_opened',
    'تم نسخ صفقة جديدة',
    'تم نسخ صفقة ' || new.symbol || ' (' || (case when new.side = 'buy' then 'شراء' else 'بيع' end) || ') من متداول تتابعه.'
  from public.subscriptions sub
  where sub.provider_id = new.provider_id
    and sub.is_active = true;

  return new;
end;
$$;

-- ---------- Notify followers (and settle wallets) when it closes ----------

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
  v_net numeric;
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
      v_net := v_pnl - v_fee;

      update public.simulated_positions
      set exit_price = new.exit_price,
          status = 'closed',
          closed_at = now(),
          pnl = v_net
      where id = v_position.id;

      update public.profiles
      set balance = balance + v_net
      where id = v_position.follower_id
      returning balance into v_follower_balance;

      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (
        v_position.follower_id, 'pnl', v_net, v_follower_balance,
        'نتيجة صفقة منسوخة: ' || new.symbol
      );

      insert into public.notifications (user_id, type, title, body)
      values (
        v_position.follower_id,
        'copy_closed',
        'أُغلقت صفقة منسوخة',
        'أُغلقت صفقة ' || new.symbol || ' بنتيجة ' ||
          (case when v_net >= 0 then '+' else '' end) || v_net || '$'
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

-- ---------- Notify a user when their KYC submission is reviewed ----------

create function public.notify_kyc_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body)
    values (
      new.user_id,
      'kyc_' || new.status,
      case when new.status = 'approved' then 'تم قبول طلب التوثيق' else 'تم رفض طلب التوثيق' end,
      case
        when new.status = 'approved' then 'تمت الموافقة على طلب توثيق الهوية الخاص بك.'
        else 'تم رفض طلب توثيق الهوية. يرجى التواصل مع الدعم لمعرفة السبب.'
      end
    );
  end if;
  return new;
end;
$$;

create trigger on_kyc_status_change
  after update on public.kyc_submissions
  for each row execute function public.notify_kyc_status_change();
