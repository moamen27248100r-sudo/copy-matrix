-- ============================================================
-- Copy Matrix — remove the performance-fee/commission system,
-- turn deposits/withdrawals into admin-approved requests instead
-- of instant self-service, and add a real-vs-demo account type
-- chosen at signup.
-- ============================================================

-- ---------- Drop commission from the copy-close settlement ----------

create or replace function public.close_simulated_positions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position record;
  v_pnl numeric;
  v_follower_balance numeric;
  v_sub record;
  v_cumulative_pnl numeric;
begin
  if new.status = 'closed' and old.status = 'open' then
    for v_position in
      select * from public.simulated_positions
      where signal_id = new.id and status = 'open'
    loop
      v_pnl := ((new.exit_price - v_position.entry_price) / v_position.entry_price)
               * v_position.size
               * (case when new.side = 'sell' then -1 else 1 end);

      update public.simulated_positions
      set exit_price = new.exit_price,
          status = 'closed',
          closed_at = now(),
          pnl = v_pnl
      where id = v_position.id;

      update public.profiles
      set balance = balance + v_pnl
      where id = v_position.follower_id
      returning balance into v_follower_balance;

      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (
        v_position.follower_id, 'pnl', v_pnl, v_follower_balance,
        'نتيجة صفقة منسوخة: ' || new.symbol
      );

      insert into public.notifications (user_id, type, title, body)
      values (
        v_position.follower_id,
        'copy_closed',
        'أُغلقت صفقة منسوخة',
        'أُغلقت صفقة ' || new.symbol || ' بنتيجة ' ||
          (case when v_pnl >= 0 then '+' else '' end) || round(v_pnl, 2) || '$'
      );

      select id, allocated_amount, max_drawdown_pct, is_active into v_sub
      from public.subscriptions where id = v_position.subscription_id;

      if v_sub.is_active then
        select coalesce(sum(pnl), 0) into v_cumulative_pnl
        from public.simulated_positions
        where subscription_id = v_sub.id and status = 'closed';

        if v_cumulative_pnl <= -(v_sub.allocated_amount * v_sub.max_drawdown_pct / 100) then
          update public.subscriptions set is_active = false where id = v_sub.id;

          insert into public.notifications (user_id, type, title, body)
          values (
            v_position.follower_id,
            'auto_stop_copy',
            'تم إيقاف النسخ تلقائيًا',
            'تم إيقاف متابعة أحد المتداولين تلقائيًا بعد تجاوز حد الخسارة المسموح به (' ||
              v_sub.max_drawdown_pct || '%). يمكنك متابعته مجددًا في أي وقت من صفحة اكتشاف المتداولين.'
          );
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

alter table public.providers drop column commission_pct;

-- ---------- Deposits/withdrawals become admin-approved requests ----------

create table public.wallet_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.wallet_requests enable row level security;

create policy "wallet_requests_select_own" on public.wallet_requests
  for select to authenticated using (user_id = auth.uid());

create policy "wallet_requests_insert_own" on public.wallet_requests
  for insert to authenticated with check (user_id = auth.uid());

create policy "wallet_requests_select_admin" on public.wallet_requests
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "wallet_requests_update_admin" on public.wallet_requests
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create function public.apply_wallet_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.type = 'withdrawal' then
      select balance into v_balance from public.profiles where id = new.user_id;
      if v_balance < new.amount then
        raise exception 'رصيد المستخدم غير كافٍ لإتمام السحب';
      end if;
      update public.profiles set balance = balance - new.amount where id = new.user_id
      returning balance into v_balance;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (new.user_id, 'withdrawal', -new.amount, v_balance, 'سحب تمت الموافقة عليه');
    else
      update public.profiles set balance = balance + new.amount where id = new.user_id
      returning balance into v_balance;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (new.user_id, 'deposit', new.amount, v_balance, 'إيداع تمت الموافقة عليه');
    end if;

    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body)
    values (
      new.user_id,
      'wallet_' || new.type || '_approved',
      case when new.type = 'deposit' then 'تم قبول طلب الإيداع' else 'تم قبول طلب السحب' end,
      'تم تنفيذ طلبك بمبلغ ' || new.amount || '$.'
    );
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body)
    values (
      new.user_id,
      'wallet_' || new.type || '_rejected',
      case when new.type = 'deposit' then 'تم رفض طلب الإيداع' else 'تم رفض طلب السحب' end,
      'تم رفض طلبك. يرجى التواصل مع الدعم لمعرفة السبب.'
    );
  end if;
  return new;
end;
$$;

create trigger on_wallet_request_reviewed
  before update on public.wallet_requests
  for each row execute function public.apply_wallet_request();

-- ---------- Real vs demo account type, chosen at signup ----------

alter table public.profiles
  add column account_type text not null default 'demo' check (account_type in ('real', 'demo'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'demo')
  );
  return new;
end;
$$;
