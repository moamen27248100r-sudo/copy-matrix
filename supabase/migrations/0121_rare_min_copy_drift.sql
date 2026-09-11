-- ============================================================
-- Copy Matrix — min_copy_amount was nudging on EVERY trade close
-- (small, but for every provider whose signal just closed), which
-- reads as continuous drift rather than the occasional, per-leader
-- change requested. Now it only has a 1.5% chance per close to roll
-- a change at all, and when it does, it shifts by a random $50-150
-- step in either direction (still floored at $200, still always a
-- $50 multiple) -- rare and per-leader, not continuous drift.
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_market_simulation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dow int;
  v_month_day text;
  v_market_closed boolean;
  v_current_hour int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_crypto_symbols text[] := array['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
  v_forex_symbols text[] := array['EURUSD','GBPUSD','USDJPY'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_first_ar text[] := array['أحمد','محمد','علي','حسين','إبراهيم','عبدالله','يوسف','خالد','سعيد','طارق','فاطمة','مريم','نورة','هدى','سارة','ريم','منى','عائشة','زينب','لمى','عمر','بلال','وليد','ماجد','رامي','سلمى','دانة','شهد','جود','لين'];
  v_last_ar text[] := array['الشريف','العتيبي','المطيري','القحطاني','الزهراني','النجار','حداد','صالح','شاهين','كنعان','درويش','سالم','بركات','عيسى','قاسم','حمدان','الجابر','السيد','مراد','توفيق'];
  v_first_intl text[] := array['David','Anna','Lucas','Maria','John','Olivia','Elena','Ryan','Sofia','Thomas','Laura','Marco','Julia','Erik','Charlotte','Felix','Camille','Jonas','Chloe','Pablo','Yuki','Wei','Ji-woo','Haruto','Mei','Kenji','Xin','Somchai','Nur','Minh','Diego','Valentina','Mariana','Sebastián','Beatriz','Rodrigo','Camila','Andrés'];
  v_last_intl text[] := array['Kim','Petrova','Costa','Santos','Miller','Wright','Malik','Popescu','O''Connor','Rossi','Wagner','Novak','Larsen','Fischer','Dubois','Tanaka','Zhang','Nguyen','Sharma','Haugen','Hernández','Gómez','Muñoz','Vargas','Silva','Rojas'];
  v_signal record;
  v_provider record;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_anchor numeric;
  v_move numeric;
  v_is_win boolean;
  v_archetype text;
  v_notional numeric := 2000;
  v_pnl numeric;
  v_withdrawal_bump numeric;
  v_follower_delta int;
  v_follower_cap int;
  v_roll numeric;
  v_base_loss numeric;
  v_pip_size numeric;
  v_pip_value_per_lot numeric;
  v_trend_up boolean;
  v_exit_price numeric;
  v_pips numeric;
  v_risk_fraction numeric;
  v_lot_size numeric;
  v_in_session boolean;
  v_target_pips numeric;
  v_target_distance numeric;
  v_lagged_entry numeric;
  v_skill_rr numeric;
  v_scalp_pip_cap numeric;
  v_window_minutes int;
  v_micro numeric;
  v_open_prob numeric;
  v_margin_call boolean;
  v_new_margin_count int;
  v_recover_prob numeric;
  v_join_prob numeric;
  v_churn_prob numeric;
  v_cap_ceiling numeric;
  v_cap_roll numeric;
  v_cap_lo numeric;
  v_cap_hi numeric;
  v_new_customer_capital numeric;
  v_name_first text;
  v_name_last text;
  v_current_price numeric;
  v_hit_tp boolean;
  v_hit_sl boolean;
  v_close_trigger text;
  v_tp_pips numeric;
  v_sl_pips numeric;
  v_bucket text;
begin
  v_dow := extract(dow from now());
  v_month_day := to_char(now(), 'MM-DD');
  v_current_hour := extract(hour from now())::int;

  v_market_closed := (
    v_dow = 6
    or (v_dow = 0 and v_current_hour < 22)
    or (v_dow = 5 and v_current_hour >= 22)
    or v_month_day in ('01-01', '12-25')
  );

  for v_signal in
    select s.id, s.provider_id, s.side, s.entry_price, s.symbol, s.opened_at, s.predetermined_win,
      s.take_profit, s.stop_loss,
      coalesce(p.skill, 0.55) as skill, p.display_name, p.country, p.min_copy_amount,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      coalesce(p.trading_style, 'moderate') as trading_style,
      p.rr_ratio, p.account_capital,
      (select mp.price from public.market_prices mp where mp.symbol = s.symbol) as live_price
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and coalesce(s.is_margin_call, false) = false
      and (
        s.opened_at < now() - (
          case
            when p.trading_style = 'scalper'
              then (floor(random() * 55 + 5) || ' minutes')::interval
            when p.risk_archetype = 'high_risk' and p.display_name not in ('أنس ريان', 'يوسف علي')
              then (floor(random() * 7200 + 2880) || ' minutes')::interval
            else (floor(random() * 2640 + 240) || ' minutes')::interval
          end
        )
        or (
          (s.take_profit is not null or s.stop_loss is not null)
          and exists (
            select 1 from public.market_prices mp
            where mp.symbol = s.symbol
              and (
                (s.side = 'buy' and (
                  (s.take_profit is not null and mp.price >= s.take_profit)
                  or (s.stop_loss is not null and mp.price <= s.stop_loss)
                ))
                or (s.side = 'sell' and (
                  (s.take_profit is not null and mp.price <= s.take_profit)
                  or (s.stop_loss is not null and mp.price >= s.stop_loss)
                ))
              )
          )
        )
      )
      and (not v_market_closed or s.symbol = any(v_crypto_symbols))
    order by s.opened_at asc
    limit 40
  loop
    v_archetype := case when v_signal.display_name in ('أنس ريان', 'يوسف علي') then 'flagship' else v_signal.risk_archetype end;
    v_current_price := v_signal.live_price;
    v_hit_tp := false;
    v_hit_sl := false;

    if v_current_price is not null then
      if v_signal.take_profit is not null then
        if v_signal.side = 'buy' then
          v_hit_tp := v_current_price >= v_signal.take_profit;
        else
          v_hit_tp := v_current_price <= v_signal.take_profit;
        end if;
      end if;
      if v_signal.stop_loss is not null then
        if v_signal.side = 'buy' then
          v_hit_sl := v_current_price <= v_signal.stop_loss;
        else
          v_hit_sl := v_current_price >= v_signal.stop_loss;
        end if;
      end if;
    end if;

    if v_hit_sl then
      v_close_trigger := 'sl';
      v_is_win := false;
      v_side := v_signal.side;
      v_exit_price := v_signal.stop_loss;
    elsif v_hit_tp then
      v_close_trigger := 'tp';
      v_is_win := true;
      v_side := v_signal.side;
      v_exit_price := v_signal.take_profit;
    else
      v_is_win := coalesce(v_signal.predetermined_win, random() < v_signal.skill);

      if random() < 0.10 then
        v_close_trigger := 'breakeven';
        v_move := 0.0005 + random() * 0.0020;
      else
        v_close_trigger := 'timeout';
        v_skill_rr := greatest(0.6, least(5.0, 3.0 + (coalesce(v_signal.skill, 0.55) - 0.55) * 6.667));

        case v_archetype
          when 'flagship' then
            v_base_loss := 0.005 + random() * 0.010;
            v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
          when 'stable' then
            v_base_loss := 0.005 + random() * 0.010;
            v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
          when 'good_rr' then
            v_base_loss := 0.01 + random() * 0.03;
            v_move := case when v_is_win then v_base_loss * coalesce(v_signal.rr_ratio, 2.5) else v_base_loss end;
          when 'high_risk' then
            v_base_loss := 0.05 + random() * 0.20;
            v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
          when 'struggling' then
            v_move := case when v_is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end;
          else
            v_base_loss := 0.010 + random() * 0.020;
            v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
        end case;

        if v_signal.trading_style = 'scalper' then
          v_move := v_move * (0.15 + random() * 0.15);
        end if;
      end if;

      select
        (select price from public.price_history where symbol = v_signal.symbol and ts >= v_signal.opened_at order by ts desc limit 1) > v_signal.entry_price
      into v_trend_up;

      if v_trend_up is not null then
        v_side := case when (v_trend_up and v_is_win) or ((not v_trend_up) and (not v_is_win)) then 'buy' else 'sell' end;
      else
        v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      end if;

      v_exit_price := round(
        case
          when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
            then v_signal.entry_price * (1 + v_move)
          else v_signal.entry_price * (1 - v_move)
        end,
        4
      );
    end if;

    case v_signal.symbol
      when 'XAUUSD' then v_pip_size := 0.1; v_pip_value_per_lot := 10;
      when 'EURUSD' then v_pip_size := 0.0001; v_pip_value_per_lot := 10;
      when 'GBPUSD' then v_pip_size := 0.0001; v_pip_value_per_lot := 10;
      when 'USDJPY' then v_pip_size := 0.01; v_pip_value_per_lot := 9;
      when 'BTCUSDT' then v_pip_size := 1; v_pip_value_per_lot := 1;
      when 'ETHUSDT' then v_pip_size := 0.1; v_pip_value_per_lot := 1;
      when 'SOLUSDT' then v_pip_size := 0.01; v_pip_value_per_lot := 1;
      when 'BNBUSDT' then v_pip_size := 0.1; v_pip_value_per_lot := 1;
      when 'XRPUSDT' then v_pip_size := 0.0001; v_pip_value_per_lot := 1;
      else v_pip_size := 1; v_pip_value_per_lot := 1; -- US30
    end case;

    if v_close_trigger in ('timeout', 'breakeven') and v_signal.trading_style = 'scalper' then
      v_scalp_pip_cap := 15 + random() * 25;
      if abs(v_exit_price - v_signal.entry_price) / v_pip_size > v_scalp_pip_cap then
        v_exit_price := round(
          v_signal.entry_price + (v_scalp_pip_cap * v_pip_size) * (case when v_exit_price > v_signal.entry_price then 1 else -1 end),
          4
        );
      end if;
    end if;

    v_pips := abs(v_exit_price - v_signal.entry_price) / v_pip_size;
    v_risk_fraction := case v_archetype
      when 'flagship' then 0.01 + random() * 0.02
      when 'stable' then 0.005 + random() * 0.015
      when 'good_rr' then 0.01 + random() * 0.015
      when 'high_risk' then 0.02 + random() * 0.06
      when 'struggling' then 0.02 + random() * 0.04
      else 0.01 + random() * 0.02
    end;

    if v_pips > 0 and coalesce(v_signal.account_capital, 0) > 0 then
      v_lot_size := greatest(0.01, round((v_signal.account_capital * v_risk_fraction / (v_pips * v_pip_value_per_lot))::numeric, 2));
      v_pnl := round((v_pips * v_pip_value_per_lot * v_lot_size * (case when v_is_win then 1 else -1 end))::numeric, 2);
    else
      v_lot_size := 0.01;
      v_pnl := round((v_notional * greatest(v_pips * v_pip_size / greatest(v_signal.entry_price, 1), 0.001) * (case when v_is_win then 1 else -1 end))::numeric, 2);
    end if;

    update public.signals
    set status = 'closed',
        side = v_side,
        exit_price = v_exit_price,
        lot_size = v_lot_size,
        closed_at = now(),
        close_trigger = v_close_trigger
    where id = v_signal.id;

    v_withdrawal_bump := case
      when v_pnl > 0 and random() < 0.35 then round((v_pnl * (0.1 + random() * 0.3))::numeric, 2)
      else 0
    end;

    v_follower_delta := case
      when v_is_win and random() < (case when v_archetype in ('flagship', 'high_risk') then 0.45 else 0.20 end)
        then 1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 6 else 3 end))::int
      when (not v_is_win) and v_archetype = 'struggling' and random() < 0.28
        then -(1 + floor(random() * 2)::int)
      when (not v_is_win) and v_archetype <> 'struggling' and random() < 0.07
        then -(1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 3 else 1 end))::int)
      else 0
    end;

    v_follower_cap := case v_archetype when 'flagship' then 2300 when 'high_risk' then 2300 when 'struggling' then 60 else 520 end;

    update public.providers
    set total_profit = total_profit + v_pnl,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta)),
        account_capital = greatest(50, coalesce(account_capital, 0) + v_pnl - v_withdrawal_bump),
        min_copy_amount = case
          when random() < 0.015 then
            greatest(200, min_copy_amount + (case when random() < 0.5 then 1 else -1 end) * (50 * (1 + floor(random() * 3)::int)))
          else min_copy_amount
        end
    where id = v_signal.provider_id;

    with pre as (
      select id, current_capital, starting_capital,
        round(
          (current_capital * (v_pnl / greatest(coalesce(v_signal.account_capital, v_notional), 1)))::numeric,
          2
        ) as gain
      from public.synthetic_customers
      where provider_id = v_signal.provider_id
        and joined_at <= v_signal.opened_at
        and copy_status = 'active'
    ),
    updated as (
      update public.synthetic_customers sc
      set current_capital = greatest(10, least(pre.starting_capital * 8, round((pre.current_capital + pre.gain)::numeric, 2)))
      from pre
      where sc.id = pre.id
      returning sc.id, sc.current_capital, pre.starting_capital
    ),
    qualifying as (
      select id, gain from pre
      where v_pnl > 0 and random() < 0.03
    ),
    inserted as (
      insert into public.synthetic_customer_withdrawals (customer_id, provider_id, signal_id, amount, occurred_at)
      select id, v_signal.provider_id, v_signal.id,
        round((gain * (0.10 + random() * 0.30))::numeric, 2),
        now()
      from qualifying
      returning customer_id, amount
    ),
    withdrawn as (
      update public.synthetic_customers sc2
      set current_capital = greatest(10, round((sc2.current_capital - i.amount)::numeric, 2))
      from inserted i
      where sc2.id = i.customer_id
      returning sc2.id, sc2.current_capital
    ),
    final_state as (
      select u.id, u.starting_capital, coalesce(w.current_capital, u.current_capital) as final_capital
      from updated u
      left join withdrawn w on w.id = u.id
    ),
    newly_paused as (
      update public.synthetic_customers sc3
      set copy_status = 'paused'
      from final_state fs
      where sc3.id = fs.id
        and (fs.final_capital <= fs.starting_capital * 0.1 or random() < 0.0003)
      returning sc3.id
    )
    insert into public.synthetic_customer_pauses (customer_id, provider_id, paused_at)
    select id, v_signal.provider_id, now() from newly_paused;

    v_join_prob := case v_archetype
      when 'stable' then 0.05
      when 'flagship' then 0.05
      when 'good_rr' then 0.04
      when 'struggling' then 0.015
      when 'high_risk' then 0.01
      else 0.03
    end;

    v_churn_prob := case v_archetype
      when 'stable' then 0.008
      when 'flagship' then 0.006
      when 'good_rr' then 0.012
      when 'struggling' then 0.05
      when 'high_risk' then 0.06
      else 0.02
    end;

    if v_is_win and random() < v_join_prob then
      v_cap_ceiling := 5000 + greatest(0, v_signal.skill - 0.2) * 85000;
      v_cap_roll := random();
      if v_cap_roll < 0.60 then
        v_cap_lo := v_signal.min_copy_amount; v_cap_hi := least(800, v_cap_ceiling);
      elsif v_cap_roll < 0.87 then
        v_cap_lo := least(800, v_cap_ceiling); v_cap_hi := least(3000, v_cap_ceiling);
      elsif v_cap_roll < 0.97 then
        v_cap_lo := least(3000, v_cap_ceiling); v_cap_hi := least(8000, v_cap_ceiling);
      elsif v_cap_roll < 0.995 then
        v_cap_lo := least(8000, v_cap_ceiling); v_cap_hi := least(20000, v_cap_ceiling);
      else
        v_cap_lo := least(20000, v_cap_ceiling); v_cap_hi := v_cap_ceiling;
      end if;
      if v_cap_hi <= v_cap_lo then
        v_cap_lo := v_signal.min_copy_amount; v_cap_hi := least(800, v_cap_ceiling);
      end if;
      v_cap_lo := greatest(v_signal.min_copy_amount, v_cap_lo);
      v_cap_hi := greatest(v_cap_lo + 1, v_cap_hi);
      v_new_customer_capital := round((v_cap_lo * power(v_cap_hi / v_cap_lo, random()))::numeric, 2);

      if v_signal.country is not null or random() < 0.1 then
        v_name_first := v_first_intl[1 + floor(random() * array_length(v_first_intl, 1))::int];
        v_name_last := v_last_intl[1 + floor(random() * array_length(v_last_intl, 1))::int];
      else
        v_name_first := v_first_ar[1 + floor(random() * array_length(v_first_ar, 1))::int];
        v_name_last := v_last_ar[1 + floor(random() * array_length(v_last_ar, 1))::int];
      end if;

      insert into public.synthetic_customers (provider_id, display_name, starting_capital, current_capital, joined_at, copy_status)
      values (v_signal.provider_id, v_name_first || ' ' || v_name_last, v_new_customer_capital, v_new_customer_capital, now(), 'active');
    end if;

    if (not v_is_win) and random() < v_churn_prob then
      update public.synthetic_customers
      set copy_status = 'left'
      where id = (
        select id from public.synthetic_customers
        where provider_id = v_signal.provider_id and copy_status = 'active'
        order by random() limit 1
      );
    end if;
  end loop;

  for v_provider in
    select id, symbol_bias, session_start_hour, session_end_hour,
      coalesce(risk_archetype, 'balanced') as risk_archetype,
      coalesce(trading_style, 'moderate') as trading_style,
      coalesce(activity_weight, 1) as activity_weight,
      coalesce(skill, 0.55) as skill,
      account_capital,
      coalesce(trading_status, 'active') as trading_status,
      coalesce(margin_call_count, 0) as margin_call_count
    from public.providers
  loop
    with resume_roll as (
      select id, starting_capital from public.synthetic_customers
      where provider_id = v_provider.id
        and copy_status = 'paused'
        and random() < 0.00005
    ),
    resumed as (
      update public.synthetic_customers sc
      set copy_status = 'active',
          current_capital = greatest(10, round((sc.starting_capital * (0.3 + random() * 0.5))::numeric, 2))
      from resume_roll rr
      where sc.id = rr.id
      returning sc.id, sc.current_capital
    )
    update public.synthetic_customer_pauses scp
    set resumed_at = now(), redeposit_amount = r.current_capital
    from resumed r
    where scp.customer_id = r.id and scp.resumed_at is null;

    if v_provider.trading_status = 'stopped' then
      continue;
    end if;

    if v_provider.risk_archetype = 'high_risk' then
      v_margin_call := coalesce(v_provider.account_capital, 0) < 200 or random() < 0.000023;

      if v_margin_call then
        update public.signals s
        set status = 'closed',
            exit_price = round((
              case when s.side = 'buy' then s.entry_price * (1 - (0.20 + random() * 0.20))
                   else s.entry_price * (1 + (0.20 + random() * 0.20))
              end
            )::numeric, 4),
            closed_at = now(),
            close_trigger = 'margin_call'
        where s.provider_id = v_provider.id and s.status = 'open' and s.is_margin_call = true;

        if found then
          v_new_margin_count := v_provider.margin_call_count + 1;
          v_recover_prob := case when v_new_margin_count = 1 then 0.70 when v_new_margin_count = 2 then 0.50 else 0.25 end;

          if random() < v_recover_prob then
            update public.providers
            set account_capital = round(500 + random() * 14500)::numeric,
                trading_status = 'active',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count
            where id = v_provider.id;
          else
            update public.providers
            set account_capital = round(coalesce(v_provider.account_capital, 0) * (0.01 + random() * 0.04), 2),
                trading_status = 'stopped',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count
            where id = v_provider.id;
          end if;

          continue;
        end if;

        update public.signals s
        set status = 'closed',
            exit_price = round((
              case when s.side = 'buy' then s.entry_price * (1 - (0.20 + random() * 0.20))
                   else s.entry_price * (1 + (0.20 + random() * 0.20))
              end
            )::numeric, 4),
            closed_at = now(),
            close_trigger = 'margin_call'
        where s.provider_id = v_provider.id and s.status = 'open';

        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
        v_side := case when random() < 0.5 then 'buy' else 'sell' end;

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_symbol_idx := array_position(v_symbols, v_symbol);
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        v_entry := round((
          v_anchor * (case when v_side = 'buy' then 1 + (0.15 + random() * 0.15) else 1 - (0.15 + random() * 0.15) end)
        )::numeric, 4);

        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size, is_margin_call)
        values (
          v_provider.id, v_symbol, v_side, v_entry, 'open',
          now() - (floor(random() * 360 + 120) || ' minutes')::interval,
          round((3 + random() * 9)::numeric, 2), true
        );

        continue;
      end if;
    end if;

    v_in_session := true;
    v_window_minutes := null;
    if v_provider.trading_style = 'session_trader' then
      if v_provider.session_start_hour is not null and v_provider.session_end_hour is not null then
        if v_provider.session_start_hour <= v_provider.session_end_hour then
          v_in_session := v_current_hour >= v_provider.session_start_hour and v_current_hour < v_provider.session_end_hour;
          v_window_minutes := (v_provider.session_end_hour - v_provider.session_start_hour) * 60;
        else
          v_in_session := v_current_hour >= v_provider.session_start_hour or v_current_hour < v_provider.session_end_hour;
          v_window_minutes := (24 - v_provider.session_start_hour + v_provider.session_end_hour) * 60;
        end if;
      else
        v_in_session := false;
      end if;
    end if;

    v_micro := greatest(0.75, least(1.25, v_provider.activity_weight));

    v_open_prob := case v_provider.trading_style
      when 'scalper' then 0.019 * v_micro
      when 'moderate' then 0.0035 * v_micro
      when 'sporadic' then 0.0007 * v_micro
      when 'session_trader' then
        case when v_in_session and v_window_minutes is not null then (1.5 * v_micro) / v_window_minutes else 0 end
      else 0.0035 * v_micro
    end;

    if random() < v_open_prob then
      v_roll := random();
      if v_roll < 0.60 then
        v_symbol := 'XAUUSD';
      elsif v_provider.symbol_bias is not null then
        v_roll := random();
        v_symbol := case
          when v_roll < 0.40 then v_provider.symbol_bias[1]
          when v_roll < 0.68 then v_provider.symbol_bias[2]
          when v_roll < 0.84 then v_provider.symbol_bias[3]
          when v_roll < 0.96 then v_provider.symbol_bias[4]
          else v_provider.symbol_bias[5 + floor(random() * 6)::int]
        end;
      else
        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
      end if;

      -- forex pairs only get a real price update once a day (no
      -- intraday movement) -- drastically cut them down instead of
      -- pretending they're as live as crypto/gold.
      if v_symbol = any(v_forex_symbols) and random() > 0.03 then
        v_symbol := 'XAUUSD';
      end if;

      if not v_market_closed or v_symbol = any(v_crypto_symbols) then
        v_symbol_idx := array_position(v_symbols, v_symbol);

        case v_symbol
          when 'XAUUSD' then v_pip_size := 0.1;
          when 'EURUSD' then v_pip_size := 0.0001;
          when 'GBPUSD' then v_pip_size := 0.0001;
          when 'USDJPY' then v_pip_size := 0.01;
          when 'BTCUSDT' then v_pip_size := 1;
          when 'ETHUSDT' then v_pip_size := 0.1;
          when 'SOLUSDT' then v_pip_size := 0.01;
          when 'BNBUSDT' then v_pip_size := 0.1;
          when 'XRPUSDT' then v_pip_size := 0.0001;
          else v_pip_size := 1; -- US30
        end case;

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        v_target_pips := case v_provider.risk_archetype
          when 'flagship' then 30 + random() * 60
          when 'high_risk' then 80 + random() * 220
          when 'struggling' then 50 + random() * 100
          when 'good_rr' then 35 + random() * 65
          when 'stable' then 40 + random() * 70
          else 40 + random() * 80
        end;

        if v_provider.trading_style = 'scalper' then
          v_target_pips := 8 + random() * 17;
        end if;

        v_target_distance := v_target_pips * v_pip_size;

        select price into v_lagged_entry
        from public.price_history
        where symbol = v_symbol and abs(price - v_anchor) >= v_target_distance
        order by ts desc limit 1;

        if v_lagged_entry is not null then
          v_entry := v_lagged_entry;
        else
          v_entry := round((v_anchor * (1 + (random() - 0.5) * 0.01))::numeric, 4);
        end if;

        v_side := case when random() < 0.5 then 'buy' else 'sell' end;
        v_is_win := random() < v_provider.skill;

        v_tp_pips := case v_provider.risk_archetype
          when 'flagship' then 15 + random() * 40
          when 'high_risk' then 60 + random() * 200
          when 'struggling' then 20 + random() * 50
          when 'good_rr' then 25 + random() * 70
          when 'stable' then 20 + random() * 45
          else 20 + random() * 50
        end;
        v_sl_pips := case v_provider.risk_archetype
          when 'flagship' then 15 + random() * 35
          when 'high_risk' then 50 + random() * 180
          when 'struggling' then 15 + random() * 40
          when 'good_rr' then 15 + random() * 35
          when 'stable' then 18 + random() * 40
          else 18 + random() * 45
        end;
        if v_provider.trading_style = 'scalper' then
          v_tp_pips := 8 + random() * 20;
          v_sl_pips := 8 + random() * 20;
        end if;

        if v_is_win then
          v_sl_pips := v_sl_pips * (1.4 + random() * 0.8);
        else
          v_tp_pips := v_tp_pips * (1.4 + random() * 0.8);
        end if;

        v_roll := random();
        if v_provider.trading_style = 'scalper' then
          v_bucket := case when v_roll < 0.60 then 'both' when v_roll < 0.75 then 'tp_only' when v_roll < 0.90 then 'sl_only' else 'neither' end;
        elsif v_provider.risk_archetype in ('high_risk', 'struggling') then
          v_bucket := case when v_roll < 0.30 then 'both' when v_roll < 0.45 then 'tp_only' when v_roll < 0.70 then 'sl_only' else 'neither' end;
        else
          v_bucket := case when v_roll < 0.45 then 'both' when v_roll < 0.65 then 'tp_only' when v_roll < 0.85 then 'sl_only' else 'neither' end;
        end if;

        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, predetermined_win, take_profit, stop_loss)
        values (
          v_provider.id, v_symbol, v_side, v_entry, 'open', now(), v_is_win,
          case when v_bucket in ('both', 'tp_only') then
            (case when v_side = 'buy' then round((v_entry + v_tp_pips * v_pip_size)::numeric, 4)
                  else round((v_entry - v_tp_pips * v_pip_size)::numeric, 4) end)
            else null end,
          case when v_bucket in ('both', 'sl_only') then
            (case when v_side = 'buy' then round((v_entry - v_sl_pips * v_pip_size)::numeric, 4)
                  else round((v_entry + v_sl_pips * v_pip_size)::numeric, 4) end)
            else null end
        );
      end if;
    end if;
  end loop;
end;
$function$
;
