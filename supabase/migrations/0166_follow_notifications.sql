-- Adds in-platform notifications for "متابعة" (follow, the free watch-only
-- action -- distinct from "نسخ"/copy) instead of only the one-time email
-- sent when the follow starts. Every real user following a provider now
-- gets a notification in their own notification feed whenever that
-- provider closes a trade, mirroring the existing copy_closed pattern for
-- actual copiers but for followers instead.
--
-- Live definition pulled via pg_get_functiondef() before editing (per
-- project convention); only the new block after the existing copier loop
-- was added, nothing else changed.

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

    -- "متابعة" (follow, free, no money) is separate from "نسخ" (copy, the
    -- loop above) -- a follower gets a notification for every closed trade
    -- from any provider they follow, regardless of whether they also copy
    -- them. Only real users can follow (follows.follower_id -> auth users),
    -- never synthetic customers, so this is always a small, cheap lookup.
    if exists (select 1 from public.follows where provider_id = new.provider_id) then
      select coalesce(pr.display_name, p.display_name) into v_provider_name
      from public.providers p
      left join public.profiles pr on pr.id = p.user_id
      where p.id = new.provider_id;

      v_pct := round(
        (((new.exit_price - new.entry_price) / new.entry_price)
          * (case when new.side = 'sell' then -1 else 1 end) * 100)::numeric,
        2
      );

      for v_follower_id in
        select follower_id from public.follows where provider_id = new.provider_id
      loop
        insert into public.notifications (user_id, type, title, body)
        values (
          v_follower_id,
          'followed_trade_closed',
          'صفقة جديدة من متداول تتابعه',
          coalesce(v_provider_name, 'متداول') || ' أغلق صفقة ' || new.symbol || ' بنتيجة ' ||
            (case when v_pct >= 0 then '+' else '' end) || v_pct || '%'
        );
      end loop;
    end if;
  end if;
  return new;
end;
$function$;
