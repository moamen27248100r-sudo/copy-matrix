-- Capital allocated to an active copy subscription is now genuinely
-- reserved, not just a display-only figure (PortfolioValueBreakdown used to
-- add profiles.balance + totalAllocated together, double-counting the same
-- dollars — followProvider never actually deducted anything from balance).
-- Withdrawal now has two real gates:
--   1. Any open simulated_positions for this follower -> hard block, exact
--      message requested (reserved as margin for running trades).
--   2. Otherwise, withdrawal amount must not exceed "available" balance,
--      i.e. balance minus the allocated_amount of any currently active
--      subscription (at most one, per the existing single-active-
--      subscription rule in followProvider).
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
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.type = 'withdrawal' then
      select exists (
        select 1 from public.simulated_positions
        where follower_id = new.user_id and status = 'open'
      ) into v_has_open_positions;

      if v_has_open_positions then
        raise exception 'تعذر تقديم طلب السحب: هناك أوامر مفعّلة ورصيدك حاليًا محجوز كـ Margin لتغطية الصفقات الجارية. عند الانتهاء من الصفقات، يمكنك إيقاف النسخ أولاً لإعادة الرصيد والمكاسب للمحفظة ثم إعادة طلب السحب.';
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

-- Stop-copy now goes through this instead of a plain client-side
-- .update({is_active:false}) — blocks the transition while that specific
-- subscription still has an open copied position, same "settle first"
-- rule as withdrawal. security definer + explicit follower_id = auth.uid()
-- ownership check, same shape as self_approve_wallet_request (0090).
create function public.stop_copy(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_has_open_positions boolean;
begin
  select id into v_subscription_id
  from public.subscriptions
  where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  if v_subscription_id is null then
    return; -- nothing to stop, no-op (already inactive or never followed)
  end if;

  select exists (
    select 1 from public.simulated_positions
    where subscription_id = v_subscription_id and status = 'open'
  ) into v_has_open_positions;

  if v_has_open_positions then
    raise exception 'تعذر إيقاف النسخ حالياً: يوجد صفقات قائمة ومفعلة حالياً على حسابك. رصيدك محجوز لتغطية الهامش (Margin). يمكنك إعادة محاولة إيقاف النسخ فور انتهاء وإغلاق جميع الصفقات المفتوحة (سواء بربح أو خسارة).';
  end if;

  update public.subscriptions set is_active = false where id = v_subscription_id;
end;
$$;

grant execute on function public.stop_copy(uuid) to authenticated;
