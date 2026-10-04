-- Copy trading: one settlement path, a reason on every close, a notification
-- when a copy opens, and a stale-price guard on manual closes.
-- Rollback: supabase/rollback/0231_copy_notifications_and_close_paths.sql
--
--  * settle_copied_position() gains p_reason ('leader' | 'tp' | 'sl' | 'trailing' |
--    'manual'); it is stored in the copy_closed notification so the customer is
--    told WHY the trade closed, in their language.
--  * close_positions_on_tp_sl() passes the level that was crossed.
--  * close_simulated_positions() (the leader closes the trade) passes 'leader' and no
--    longer sends a second "followed trade closed" notice to someone who copied it.
--  * close_my_position() (manual close) now goes through settle_copied_position(), so it
--    shares the rounding, the auto-stop check and the notification with every other
--    close, and it refuses to settle on a price the feed has not refreshed for 2 minutes.
--  * mirror_signal_to_followers() / start_or_update_copy(): every copied position now
--    produces a copy_opened notification (the type existed but nothing created it), and a
--    follower who copied a trade is not also sent the "followed trade opened" notice.
--  * start_or_update_copy() serialises per (customer, trader) so two simultaneous
--    "start copying" calls cannot both copy the trader's open trades.

begin;

-- Settlement -----------------------------------------------------------------------
drop function if exists public.settle_copied_position(uuid, numeric, timestamptz);

create or replace function public.settle_copied_position(
  p_position_id uuid,
  p_exit_price numeric,
  p_closed_at timestamptz,
  p_reason text default 'leader'
)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_position record;
  v_signal record;
  v_pnl numeric;
  v_follower_balance numeric;
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

  update public.profiles
  set balance = balance + v_pnl
  where id = v_position.follower_id
  returning balance into v_follower_balance;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
  values (
    v_position.follower_id, 'pnl', v_pnl, v_follower_balance,
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
$$;

revoke all on function public.settle_copied_position(uuid, numeric, timestamptz, text) from public, anon, authenticated;

-- Manual close ------------------------------------------------------------------------
create or replace function public.close_my_position(p_position_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_position record;
  v_symbol text;
  v_price numeric;
  v_price_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select sp.* into v_position
  from public.simulated_positions sp
  where sp.id = p_position_id
    and sp.follower_id = auth.uid()
    and sp.status = 'open'
  for update;

  if not found then
    raise exception 'position_not_found_or_closed' using errcode = 'CM010';
  end if;

  select s.symbol into v_symbol from public.signals s where s.id = v_position.signal_id;

  select price, updated_at into v_price, v_price_at from public.market_prices where symbol = v_symbol;
  if v_price is null then
    raise exception 'no_market_price' using errcode = 'CM011';
  end if;
  -- The feed refreshes every few seconds; an older price means it is down, and a
  -- close at that price would not be the market's.
  if v_price_at < now() - interval '2 minutes' then
    raise exception 'stale_price' using errcode = 'CM022';
  end if;

  return public.settle_copied_position(v_position.id, v_price, now(), 'manual');
end;
$function$;

revoke all on function public.close_my_position(uuid) from public, anon;
grant execute on function public.close_my_position(uuid) to authenticated;

-- Close when the trader closes the trade ------------------------------------------------
create or replace function public.close_simulated_positions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_position_id uuid;
  v_provider_name text;
  v_pct numeric;
  v_follower_id uuid;
  v_copiers uuid[];
begin
  if new.status = 'closed' and old.status = 'open' then
    select coalesce(array_agg(distinct follower_id), '{}') into v_copiers
    from public.simulated_positions where signal_id = new.id and status = 'open';

    for v_position_id in
      select id from public.simulated_positions
      where signal_id = new.id and status = 'open'
    loop
      perform public.settle_copied_position(v_position_id, new.exit_price, now(), 'leader');
    end loop;

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

      -- Someone who copied the trade already got the copy_closed notice.
      for v_follower_id in
        select follower_id from public.follows
        where provider_id = new.provider_id and follower_id <> all (v_copiers)
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

-- Close on TP / SL / trailing -------------------------------------------------------------
create or replace function public.close_positions_on_tp_sl()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row record;
begin
  if new.price is null or new.price = old.price then
    return new;
  end if;

  -- Trailing stop: remember the best price each trailing position has seen.
  update public.simulated_positions sp
    set best_price = case when s.side = 'sell'
                          then least(coalesce(sp.best_price, sp.entry_price), new.price)
                          else greatest(coalesce(sp.best_price, sp.entry_price), new.price) end
    from public.signals s
    where s.id = sp.signal_id and s.symbol = new.symbol
      and sp.status = 'open' and sp.trail_pct is not null;

  for v_row in
    select x.id,
           case
             when x.tp_hit then 'tp'
             when x.sl_hit then 'sl'
             else 'trailing'
           end as reason
    from (
      select sp.id,
        (sp.take_profit is not null and ((s.side = 'sell' and new.price <= sp.take_profit)
                                          or (s.side <> 'sell' and new.price >= sp.take_profit))) as tp_hit,
        (sp.stop_loss is not null and ((s.side = 'sell' and new.price >= sp.stop_loss)
                                        or (s.side <> 'sell' and new.price <= sp.stop_loss))) as sl_hit,
        (sp.trail_pct is not null and ((s.side = 'sell' and new.price >= sp.best_price * (1 + sp.trail_pct / 100))
                                        or (s.side <> 'sell' and new.price <= sp.best_price * (1 - sp.trail_pct / 100)))) as trail_hit
      from public.simulated_positions sp
      join public.signals s on s.id = sp.signal_id
      where sp.status = 'open'
        and s.symbol = new.symbol
        and (sp.take_profit is not null or sp.stop_loss is not null or sp.trail_pct is not null)
    ) x
    where x.tp_hit or x.sl_hit or x.trail_hit
  loop
    begin
      perform public.settle_copied_position(v_row.id, new.price, now(), v_row.reason);
    exception when others then
      null; -- never block a price update because one position could not settle
    end;
  end loop;

  return new;
end;
$function$;

-- Opening a copy --------------------------------------------------------------------------
create or replace function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_provider_name text;
  v_copiers uuid[];
begin
  if new.created_by_admin then
    return new;
  end if;

  select coalesce(pr.display_name, p.display_name) into v_provider_name
  from public.providers p
  left join public.profiles pr on pr.id = p.user_id
  where p.id = new.provider_id;

  with ins as (
    insert into public.simulated_positions
      (signal_id, subscription_id, follower_id, entry_price, size, take_profit, stop_loss, trail_pct, best_price)
    select
      new.id,
      sub.id,
      sub.follower_id,
      new.entry_price,
      least(
        case when sub.copy_mode = 'fixed' and sub.fixed_amount is not null
             then least(sub.fixed_amount, sub.allocated_amount - coalesce(open_totals.total_open, 0))
             else sub.allocated_amount - coalesce(open_totals.total_open, 0) end,
        coalesce(sub.max_per_trade, sub.allocated_amount)
      ) as size,
      public.copy_tp_price(new.side, new.entry_price, sub.tp_pct),
      public.copy_sl_price(new.side, new.entry_price, sub.sl_pct),
      sub.trailing_pct,
      case when sub.trailing_pct is not null then new.entry_price end
    from public.subscriptions sub
    left join lateral (
      select coalesce(sum(sp.size), 0) as total_open
      from public.simulated_positions sp
      where sp.subscription_id = sub.id and sp.status = 'open'
    ) open_totals on true
    where sub.provider_id = new.provider_id
      and sub.is_active = true
      and sub.allocated_amount > coalesce(open_totals.total_open, 0)
    returning follower_id, size, entry_price
  ),
  notified as (
    insert into public.notifications (user_id, type, title, body, data)
    select
      i.follower_id,
      'copy_opened',
      'تم نسخ صفقة جديدة',
      'نُسخت صفقة ' || (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side,
        'size', i.size,
        'price', i.entry_price
      )
    from ins i
  )
  select coalesce(array_agg(follower_id), '{}') into v_copiers from ins;

  if exists (select 1 from public.follows where provider_id = new.provider_id) then
    insert into public.notifications (user_id, type, title, body, data)
    select
      f.follower_id,
      'followed_trade_opened',
      'فتح صفقة جديدة | ' || coalesce(v_provider_name, 'متداول'),
      'قام ' || coalesce(v_provider_name, 'متداول') || ' بفتح صفقة ' ||
        (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        '. يمكنك مراجعة التفاصيل الآن.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side
      )
    from public.follows f
    where f.provider_id = new.provider_id
      and f.follower_id <> all (v_copiers);
  end if;

  return new;
end;
$function$;

create or replace function public.start_or_update_copy(
  p_provider_id uuid,
  p_allocated_amount numeric,
  p_copy_mode text default 'ratio',
  p_fixed_amount numeric default null,
  p_max_per_trade numeric default null,
  p_stop_loss_pct numeric default null,
  p_tp_pct numeric default null,
  p_sl_pct numeric default null,
  p_trailing_pct numeric default null,
  p_copy_open boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance numeric;
  v_min_copy_amount numeric;
  v_trading_status text;
  v_other_allocated numeric;
  v_existing_id uuid;
  v_existing_started_at timestamptz;
  v_is_starting boolean;
  v_new_started_at timestamptz;
  v_mode text := coalesce(p_copy_mode, 'ratio');
  v_fixed numeric;
  v_max_per_trade numeric;
  v_stop_loss numeric := coalesce(p_stop_loss_pct, 50);
  v_sub_id uuid;
  v_sig record;
  v_open_total numeric;
  v_size numeric;
  v_provider_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Two simultaneous submits (double click, second tab) must not both count as "starting".
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_provider_id::text, 0));

  if p_allocated_amount is null or p_allocated_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'CM001';
  end if;

  if v_mode not in ('ratio', 'fixed') then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_fixed := case when v_mode = 'fixed' then p_fixed_amount else null end;
  if v_mode = 'fixed' and (v_fixed is null or v_fixed <= 0 or v_fixed > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_max_per_trade := p_max_per_trade;
  if v_max_per_trade is not null and (v_max_per_trade <= 0 or v_max_per_trade > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  if v_stop_loss < 1 or v_stop_loss > 90 then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  perform public.validate_copy_risk(p_tp_pct, p_sl_pct, p_trailing_pct);

  select balance into v_balance from public.profiles where id = auth.uid();
  select min_copy_amount, trading_status into v_min_copy_amount, v_trading_status
    from public.providers where id = p_provider_id;

  if v_min_copy_amount is null then
    raise exception 'provider_not_found' using errcode = 'CM002';
  end if;

  if v_trading_status = 'stopped' then
    raise exception 'trader_stopped' using errcode = 'CM003';
  end if;

  select id, copy_started_at into v_existing_id, v_existing_started_at
    from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  v_is_starting := v_existing_id is null;

  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.whitelist_enabled
  ) and not exists (
    select 1 from public.follower_invites fi
    where fi.provider_id = p_provider_id and fi.used_by = auth.uid()
  ) then
    raise exception 'not_invited' using errcode = 'CM008';
  end if;

  if not v_is_starting and now() - v_existing_started_at >= interval '10 minutes' then
    raise exception 'grace_period_expired' using errcode = 'CM004';
  end if;

  select coalesce(sum(allocated_amount), 0) into v_other_allocated
    from public.subscriptions
    where follower_id = auth.uid() and is_active = true and provider_id <> p_provider_id;

  if p_allocated_amount > coalesce(v_balance, 0) - v_other_allocated then
    raise exception 'exceeds_balance' using errcode = 'CM006';
  end if;

  if p_allocated_amount < v_min_copy_amount then
    raise exception 'below_minimum' using errcode = 'CM007';
  end if;

  v_new_started_at := case when v_is_starting then now() else v_existing_started_at end;

  insert into public.subscriptions
    (follower_id, provider_id, is_active, allocated_amount, max_drawdown_pct, copy_started_at,
     copy_mode, fixed_amount, max_per_trade, tp_pct, sl_pct, trailing_pct)
  values
    (auth.uid(), p_provider_id, true, p_allocated_amount, v_stop_loss, v_new_started_at,
     v_mode, v_fixed, v_max_per_trade, p_tp_pct, p_sl_pct, p_trailing_pct)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = v_stop_loss,
        copy_started_at = v_new_started_at,
        copy_mode = v_mode,
        fixed_amount = v_fixed,
        max_per_trade = v_max_per_trade,
        tp_pct = p_tp_pct,
        sl_pct = p_sl_pct,
        trailing_pct = p_trailing_pct
  returning id into v_sub_id;

  -- Copy the leader's trades that are open right now, at the current market
  -- price, sized exactly like a freshly mirrored trade.
  if v_is_starting and coalesce(p_copy_open, false) then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = p_provider_id;

    for v_sig in
      select s.id, s.side, s.symbol, mp.price
      from public.signals s
      join public.market_prices mp on mp.symbol = s.symbol
      where s.provider_id = p_provider_id
        and s.status = 'open'
        and coalesce(s.hidden, false) = false
        and not s.created_by_admin
        and mp.price is not null and mp.price > 0
      order by s.opened_at
    loop
      select coalesce(sum(size), 0) into v_open_total
        from public.simulated_positions where subscription_id = v_sub_id and status = 'open';
      v_size := least(
        case when v_mode = 'fixed' and v_fixed is not null
             then least(v_fixed, p_allocated_amount - v_open_total)
             else p_allocated_amount - v_open_total end,
        coalesce(v_max_per_trade, p_allocated_amount)
      );
      exit when v_size <= 0;

      insert into public.simulated_positions
        (signal_id, subscription_id, follower_id, entry_price, size, take_profit, stop_loss, trail_pct, best_price)
      values
        (v_sig.id, v_sub_id, auth.uid(), v_sig.price, v_size,
         public.copy_tp_price(v_sig.side, v_sig.price, p_tp_pct),
         public.copy_sl_price(v_sig.side, v_sig.price, p_sl_pct),
         p_trailing_pct,
         case when p_trailing_pct is not null then v_sig.price end);

      insert into public.notifications (user_id, type, title, body, data)
      values (
        auth.uid(),
        'copy_opened',
        'تم نسخ صفقة جديدة',
        'نُسخت صفقة ' || (case when v_sig.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || v_sig.symbol ||
          ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
        jsonb_build_object(
          'providerName', coalesce(v_provider_name, 'متداول'),
          'symbol', v_sig.symbol,
          'side', v_sig.side,
          'size', v_size,
          'price', v_sig.price
        )
      );
    end loop;
  end if;
end;
$function$;

revoke all on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) from public, anon;
grant execute on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) to authenticated;

commit;
