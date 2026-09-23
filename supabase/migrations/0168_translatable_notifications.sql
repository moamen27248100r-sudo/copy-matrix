-- Makes notification CONTENT translatable, not just the surrounding page
-- chrome. Previously title/body were pre-rendered Arabic strings baked in
-- at insert time by SQL triggers -- no amount of frontend i18n work could
-- change that text, since it was already fixed in the database row.
--
-- Fix: add a `data jsonb` column carrying the structured parameters each
-- notification needs (leader name, symbol, amount, percentage, ...) —
-- proper nouns and numbers only, nothing that needs translating itself.
-- The frontend renders title/body from `type` + `data` through next-intl
-- at display time, in whatever locale the viewer currently has selected.
--
-- title/body keep being populated in Arabic exactly as before (zero risk
-- to anything else reading them) -- they're now a fallback the frontend
-- uses only when `data` is null, which covers every notification that
-- already existed before this migration.
--
-- Live definitions pulled via pg_get_functiondef() before editing (per
-- project convention); only the two new lines per insert (the `data`
-- column and its value) were added to each function, nothing else changed.

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb;

CREATE OR REPLACE FUNCTION public.close_simulated_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_position record;
  v_pnl numeric;
  v_follower_balance numeric;
  v_sub record;
  v_cumulative_pnl numeric;
  v_provider_name text;
  v_pct numeric;
  v_follower_id uuid;
begin
  if new.status = 'closed' and old.status = 'open' then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = new.provider_id;

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

      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_position.follower_id,
        'copy_closed',
        'صفقة منسوخة من ' || coalesce(v_provider_name, 'متداول'),
        'أُغلقت صفقة ' || new.symbol || ' بنتيجة ' ||
          (case when v_pnl >= 0 then '+' else '' end) || round(v_pnl, 2) || '$',
        jsonb_build_object(
          'providerName', coalesce(v_provider_name, 'متداول'),
          'symbol', new.symbol,
          'amount', round(abs(v_pnl), 2),
          'positive', v_pnl >= 0
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
    end loop;

    if exists (select 1 from public.follows where provider_id = new.provider_id) then
      v_pct := round(
        (((new.exit_price - new.entry_price) / new.entry_price)
          * (case when new.side = 'sell' then -1 else 1 end) * 100)::numeric,
        2
      );

      for v_follower_id in
        select follower_id from public.follows where provider_id = new.provider_id
      loop
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_follower_id,
          'followed_trade_closed',
          'صفقة جديدة من متداول تتابعه',
          coalesce(v_provider_name, 'متداول') || ' أغلق صفقة ' || new.symbol || ' بنتيجة ' ||
            (case when v_pct >= 0 then '+' else '' end) || v_pct || '%',
          jsonb_build_object(
            'providerName', coalesce(v_provider_name, 'متداول'),
            'symbol', new.symbol,
            'pct', abs(v_pct),
            'positive', v_pct >= 0
          )
        );
      end loop;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'kyc_' || new.status,
      case when new.status = 'approved' then 'تم قبول طلب التوثيق' else 'تم رفض طلب التوثيق' end,
      case
        when new.status = 'approved' then 'تمت الموافقة على طلب توثيق الهوية الخاص بك.'
        else 'تم رفض طلب توثيق الهوية. يرجى التواصل مع الدعم لمعرفة السبب.'
      end,
      '{}'::jsonb
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_wallet_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'wallet_' || new.type || '_approved',
      case when new.type = 'deposit' then 'تم قبول طلب الإيداع' else 'تم قبول طلب السحب' end,
      'تم تنفيذ طلبك بمبلغ ' || new.amount || '$.',
      jsonb_build_object('amount', new.amount)
    );
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'wallet_' || new.type || '_rejected',
      case when new.type = 'deposit' then 'تم رفض طلب الإيداع' else 'تم رفض طلب السحب' end,
      'تم رفض طلبك. يرجى التواصل مع الدعم لمعرفة السبب.',
      '{}'::jsonb
    );
  end if;
  return new;
end;
$function$;
