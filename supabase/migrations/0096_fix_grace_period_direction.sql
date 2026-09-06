-- 0095 had the window backwards. Correct behavior: right after a copy
-- starts, the leader hasn't placed a trade yet, so everything must work
-- normally (stop-copy, amount changes, withdrawal all allowed). Once 10
-- minutes pass, simulate that the leader has now opened a trade — from
-- that point on, the same "open positions" lock applies, permanently (by
-- design — confirmed explicitly), same as any subscription already older
-- than 10 minutes when this ships.
create or replace function public.stop_copy(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_copy_started_at timestamptz;
  v_has_open_positions boolean;
begin
  select id, copy_started_at into v_subscription_id, v_copy_started_at
  from public.subscriptions
  where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  if v_subscription_id is null then
    return;
  end if;

  select exists (
    select 1 from public.simulated_positions
    where subscription_id = v_subscription_id and status = 'open'
  ) into v_has_open_positions;

  if v_has_open_positions or now() - v_copy_started_at >= interval '10 minutes' then
    raise exception 'تعذّر إيقاف النسخ حاليًا: لديك صفقات مفتوحة على هذا الحساب، ورصيدك محجوز حاليًا كهامش لتغطيتها. يُرجى إعادة المحاولة بعد إغلاق جميع الصفقات المفتوحة.';
  end if;

  update public.subscriptions set is_active = false where id = v_subscription_id;
end;
$$;

create or replace function public.apply_wallet_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_reserved numeric;
  v_available numeric;
  v_has_open_positions boolean;
  v_leader_traded boolean;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.type = 'withdrawal' then
      select exists (
        select 1 from public.simulated_positions
        where follower_id = new.user_id and status = 'open'
      ) into v_has_open_positions;

      select exists (
        select 1 from public.subscriptions
        where follower_id = new.user_id and is_active = true
          and now() - copy_started_at >= interval '10 minutes'
      ) into v_leader_traded;

      if v_has_open_positions or v_leader_traded then
        raise exception 'تعذّر تقديم طلب السحب: لديك صفقات مفتوحة حاليًا، ورصيدك محجوز كهامش لتغطيتها. يمكنك إيقاف النسخ بعد إغلاق الصفقات لإعادة الرصيد والأرباح إلى محفظتك، ثم إعادة تقديم طلب السحب.';
      end if;

      select balance into v_balance from public.profiles where id = new.user_id;
      select coalesce(sum(allocated_amount), 0) into v_reserved
        from public.subscriptions where follower_id = new.user_id and is_active = true;
      v_available := v_balance - v_reserved;

      if v_available < new.amount then
        raise exception 'رصيدك المتاح للسحب غير كافٍ — جزء من رصيدك محجوز حاليًا لحساب النسخ النشط. أوقف النسخ أولاً لإعادة هذا المبلغ إلى رصيدك المتاح.';
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
