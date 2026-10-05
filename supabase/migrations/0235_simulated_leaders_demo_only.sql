-- Simulated leaders are a demo-account feature: start_or_update_copy refuses
-- them for any other account (CM050); mirror_signal_to_followers and
-- close_simulated_positions only copy / notify demo accounts for them. The
-- function bodies are otherwise the current definitions unchanged.

begin;

CREATE OR REPLACE FUNCTION public.start_or_update_copy(p_provider_id uuid, p_allocated_amount numeric, p_copy_mode text DEFAULT 'ratio'::text, p_fixed_amount numeric DEFAULT NULL::numeric, p_max_per_trade numeric DEFAULT NULL::numeric, p_stop_loss_pct numeric DEFAULT NULL::numeric, p_tp_pct numeric DEFAULT NULL::numeric, p_sl_pct numeric DEFAULT NULL::numeric, p_trailing_pct numeric DEFAULT NULL::numeric, p_copy_open boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Simulated leaders can only be copied from a demo account.
  perform public.copy_check_leader_account(p_provider_id, auth.uid());

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

  -- While a copied trade is open the amount, mode, per-trade cap and copy stop-loss are locked;
  -- take profit / stop loss / trailing stay editable. With nothing open everything is editable.
  if not v_is_starting and exists (
    select 1 from public.simulated_positions where subscription_id = v_existing_id and status = 'open'
  ) and exists (
    select 1 from public.subscriptions s
    where s.id = v_existing_id
      and (s.allocated_amount is distinct from p_allocated_amount
        or s.copy_mode is distinct from v_mode
        or s.fixed_amount is distinct from v_fixed
        or s.max_per_trade is distinct from v_max_per_trade
        or s.max_drawdown_pct is distinct from v_stop_loss)
  ) then
    raise exception 'copy_locked_open_positions' using errcode = 'CM004';
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

CREATE OR REPLACE FUNCTION public.mirror_signal_to_followers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_name text;
  v_copiers uuid[];
  v_simulated boolean;
begin
  if new.created_by_admin then
    return new;
  end if;

  select coalesce(pr.display_name, p.display_name), p.is_simulated into v_provider_name, v_simulated
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
      -- A simulated leader's trades are only ever copied into demo accounts.
      and (not v_simulated or exists (
        select 1 from public.profiles fp where fp.id = sub.follower_id and fp.account_type = 'demo'))
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
      and f.follower_id <> all (v_copiers)
      and (not v_simulated or exists (
        select 1 from public.profiles fp where fp.id = f.follower_id and fp.account_type = 'demo'));
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.close_simulated_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        select fo.follower_id from public.follows fo
        where fo.provider_id = new.provider_id and fo.follower_id <> all (v_copiers)
          and (not exists (select 1 from public.providers sp where sp.id = new.provider_id and sp.is_simulated)
               or exists (select 1 from public.profiles fp where fp.id = fo.follower_id and fp.account_type = 'demo'))
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

commit;
