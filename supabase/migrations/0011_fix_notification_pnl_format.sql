-- ============================================================
-- Copy Matrix — fix copy-closed notification text showing raw
-- unrounded numeric (e.g. "-100.00000000000000000000$").
-- ============================================================

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
          (case when v_net >= 0 then '+' else '' end) || round(v_net, 2) || '$'
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
