-- Margin-call closes record a trade exactly like a normal close.
-- Rollback: supabase/rollback/0220_margin_call_close_lot.sql
--
-- A margin call bulk-closes a high-risk trader's open trades. Ordinary open
-- trades get their lot size only when they close (normal path), so the
-- margin-call path left them with lot_size null (no $ result, no
-- total_profit contribution). Both paths now take lot / commission / swap
-- from one helper, sim_close_costs(), and the margin-call close itself is
-- one function, sim_margin_call_close(), that the engine and tests call.
--
-- The 8 trades already closed this way have no lot anywhere (null at open,
-- null in every backup), so none is invented: they are flagged
-- needs_review + hidden with an audit row each.

begin;
set local statement_timeout = 0;

-- Lot / commission / swap for a closing simulated trade. p_lot (already
-- known, e.g. margin-call positions) is kept; otherwise the lot is sized
-- from capital x archetype risk / pip distance, as the engine always has.
create or replace function public.sim_close_costs(
  p_symbol text, p_entry numeric, p_exit numeric, p_opened_at timestamptz,
  p_archetype text, p_capital numeric, p_lot numeric,
  out lot numeric, out commission numeric, out swap numeric)
language plpgsql volatile as $$
declare
  v_pip_size numeric;
  v_pip_value numeric;
  v_pips numeric;
  v_risk numeric;
  v_days numeric;
begin
  case p_symbol
    when 'XAUUSD' then v_pip_size := 0.1; v_pip_value := 10;
    when 'EURUSD' then v_pip_size := 0.0001; v_pip_value := 10;
    when 'GBPUSD' then v_pip_size := 0.0001; v_pip_value := 10;
    when 'USDJPY' then v_pip_size := 0.01; v_pip_value := 9;
    when 'BTCUSDT' then v_pip_size := 1; v_pip_value := 1;
    when 'ETHUSDT' then v_pip_size := 0.1; v_pip_value := 1;
    when 'SOLUSDT' then v_pip_size := 0.01; v_pip_value := 1;
    when 'BNBUSDT' then v_pip_size := 0.1; v_pip_value := 1;
    when 'XRPUSDT' then v_pip_size := 0.0001; v_pip_value := 1;
    else v_pip_size := 1; v_pip_value := 1;
  end case;

  v_pips := abs(p_exit - p_entry) / v_pip_size;
  v_risk := case p_archetype
    when 'flagship' then 0.01 + random() * 0.02
    when 'stable' then 0.005 + random() * 0.015
    when 'good_rr' then 0.01 + random() * 0.015
    when 'high_risk' then 0.02 + random() * 0.06
    when 'struggling' then 0.02 + random() * 0.04
    else 0.01 + random() * 0.02
  end;

  if p_lot is not null and p_lot > 0 then
    lot := p_lot;
  elsif v_pips > 0 and coalesce(p_capital, 0) > 0 then
    lot := greatest(0.01, least(500, round((p_capital * v_risk / (v_pips * v_pip_value))::numeric, 2)));
  else
    lot := 0.01;
  end if;

  commission := round((lot * (3 + random() * 4))::numeric, 2);
  v_days := greatest(0, extract(epoch from (now() - p_opened_at)) / 86400);
  swap := case
    when p_symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT') or v_days < 1 then 0
    else round((lot * v_days * (random() * 3 - 1))::numeric, 2)
  end;
end;
$$;

-- Margin-call close of a trader's open trades (only the margin-call
-- positions when p_only_margin_positions). Exit 10-25% against the trade,
-- or at its stop if that sits closer; lot / commission / swap from
-- sim_close_costs() like any close. Returns the number of trades closed.
create or replace function public.sim_margin_call_close(
  p_provider_id uuid, p_capital numeric, p_only_margin_positions boolean)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  v_n int;
begin
  with x as (
    select s.id, s.symbol, s.side, s.entry_price, s.stop_loss, s.opened_at, s.lot_size,
      round((case when s.side = 'buy' then s.entry_price * (1 - (0.10 + random() * 0.15))
                  else s.entry_price * (1 + (0.10 + random() * 0.15)) end)::numeric, 4) as px
    from public.signals s
    where s.provider_id = p_provider_id and s.status = 'open'
      and (not p_only_margin_positions or s.is_margin_call)
  ),
  y as (
    select x.*,
      case when x.stop_loss is not null and abs(x.px - x.entry_price) >= abs(x.stop_loss - x.entry_price)
           then x.stop_loss else x.px end as exit_px
    from x
  )
  update public.signals s
  set status = 'closed',
      exit_price = y.exit_px,
      closed_at = now(),
      close_trigger = 'margin_call',
      lot_size = c.lot,
      commission = c.commission,
      swap = c.swap
  from y
  cross join lateral public.sim_close_costs(y.symbol, y.entry_price, y.exit_px, y.opened_at, 'high_risk', p_capital, y.lot_size) c
  where s.id = y.id;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.sim_margin_call_close(uuid, numeric, boolean) from public, anon, authenticated;

-- Engine.
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
  v_target_ratio numeric;
  v_projected_profit numeric;
  v_profit_ceiling numeric;
  v_follower_delta int;
  v_follower_cap int;
  v_roll numeric;
  v_base_loss numeric;
  v_pip_size numeric;
  v_pip_value_per_lot numeric;
  v_exit_price numeric;
  v_pips numeric;
  v_lot_size numeric;
  v_commission numeric;
  v_swap numeric;
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
  v_current_price numeric;
  v_hit_tp boolean;
  v_hit_sl boolean;
  v_close_trigger text;
  v_tp_pips numeric;
  v_sl_pips numeric;
  v_bucket text;
  v_has_real_follower boolean;
  v_provider_open_count int;
  v_density_floor int;
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
      s.take_profit, s.stop_loss, s.created_by_admin,
      coalesce(p.skill, 0.55) as skill, p.display_name, p.country, p.min_copy_amount,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      coalesce(p.trading_style, 'moderate') as trading_style,
      p.rr_ratio, p.account_capital,
      coalesce(p.total_profit, 0) as total_profit, coalesce(p.total_withdrawals, 0) as total_withdrawals,
      (select mp.price from public.market_prices mp where mp.symbol = s.symbol) as live_price
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and coalesce(s.is_margin_call, false) = false
      and (
        s.opened_at < now() - (
          case
            when p.trading_style = 'scalper'
              then (floor(random() * 25 + 2) || ' minutes')::interval
            when p.risk_archetype = 'high_risk' and p.display_name not in ('أنس ريان', 'يوسف علي')
              then (floor(random() * 7200 + 2880) || ' minutes')::interval
            when p.trading_style = 'sporadic'
              then (floor(random() * 18000 + 1440) || ' minutes')::interval
            when p.trading_style in ('moderate', 'session_trader')
              then (floor(random() * 420 + 30) || ' minutes')::interval
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
        -- Absolute safety net: nothing stays open more than 30 days
        -- regardless of style, TP or SL -- prevents a processing backlog
        -- from ever again producing a multi-month-old "scalper" trade.
        or s.opened_at < now() - interval '30 days'
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
      v_side := v_signal.side;

      v_close_trigger := 'timeout';
      v_skill_rr := greatest(0.6, least(5.0, 3.0 + (coalesce(v_signal.skill, 0.55) - 0.55) * 6.667));

      case v_archetype
        when 'flagship' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'stable' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'good_rr' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * coalesce(v_signal.rr_ratio, 2.5))) else v_base_loss end;
        when 'high_risk' then
          v_base_loss := 0.10 + random() * 0.15;
          v_move := case when v_is_win then greatest(0.05, least(0.15, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'struggling' then
          v_move := case when v_is_win then 0.010 + random() * 0.035 else 0.008 + random() * 0.027 end;
        else
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
      end case;

      -- The side is fixed at open (its S/L and T/P were placed for it);
      -- it is never flipped at close.
      v_exit_price := round(
        case
          when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
            then v_signal.entry_price * (1 + v_move)
          else v_signal.entry_price * (1 - v_move)
        end,
        4
      );

      -- A timed close can't run past a stop or target: that order would
      -- have filled first, at its level.
      if v_signal.stop_loss is not null
         and (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) < 0
         and abs(v_exit_price - v_signal.entry_price) >= abs(v_signal.stop_loss - v_signal.entry_price) then
        v_exit_price := v_signal.stop_loss;
        v_close_trigger := 'sl';
      elsif v_signal.take_profit is not null
         and (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) > 0
         and abs(v_exit_price - v_signal.entry_price) >= abs(v_signal.take_profit - v_signal.entry_price) then
        v_exit_price := v_signal.take_profit;
        v_close_trigger := 'tp';
      end if;
    end if;

    -- Result sign always follows side + entry + exit.
    v_is_win := (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) > 0;

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
      else v_pip_size := 1; v_pip_value_per_lot := 1;
    end case;

    v_pips := abs(v_exit_price - v_signal.entry_price) / v_pip_size;

    -- Lot, commission and swap: one helper shared with margin-call closes.
    select c.lot, c.commission, c.swap into v_lot_size, v_commission, v_swap
    from public.sim_close_costs(v_signal.symbol, v_signal.entry_price, v_exit_price, v_signal.opened_at,
                                v_archetype, v_signal.account_capital, null) c;

    if v_pips > 0 and coalesce(v_signal.account_capital, 0) > 0 then
      v_pnl := round((v_pips * v_pip_value_per_lot * v_lot_size * (case when v_is_win then 1 else -1 end))::numeric, 2);
    else
      v_pnl := round((v_notional * greatest(v_pips * v_pip_size / greatest(v_signal.entry_price, 1), 0.001) * (case when v_is_win then 1 else -1 end))::numeric, 2);
    end if;

    -- signals_integrity_guard rejects anything inconsistent; one bad row
    -- must not stall the whole engine run, so it stays open and is logged.
    begin
      update public.signals
      set status = 'closed',
          exit_price = v_exit_price,
          lot_size = v_lot_size,
          closed_at = now(),
          close_trigger = v_close_trigger,
          commission = v_commission,
          swap = v_swap
      where id = v_signal.id;
    exception when check_violation then
      raise warning 'run_market_simulation: close of signal % rejected: %', v_signal.id, sqlerrm;
      continue;
    end;

    if v_signal.created_by_admin then
      continue;
    end if;

    v_target_ratio := case v_archetype
      when 'flagship' then 0.25 + random() * 0.15
      when 'stable' then 0.20 + random() * 0.15
      when 'good_rr' then 0.20 + random() * 0.15
      when 'high_risk' then 0.08 + random() * 0.17
      when 'struggling' then 0.05 + random() * 0.10
      else 0.20 + random() * 0.15
    end;
    v_projected_profit := v_signal.total_profit + v_pnl;
    v_withdrawal_bump := case
      when v_projected_profit > 0 and v_pnl > 0 and random() < 0.35 then
        least(
          greatest(0, round(((v_projected_profit * v_target_ratio - v_signal.total_withdrawals) * (0.25 + random() * 0.35))::numeric, 2)),
          round((greatest(0, coalesce(v_signal.account_capital, 0)) * 0.15)::numeric, 2)
        )
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

    v_follower_cap := case v_archetype
      when 'flagship' then 2500
      when 'high_risk' then 15
      when 'struggling' then 60
      else 600
    end;

    v_profit_ceiling := greatest(50, coalesce(v_signal.account_capital, 0)) * (
      case v_archetype
        when 'flagship' then 12
        when 'stable' then 10
        when 'good_rr' then 12
        when 'high_risk' then 18
        when 'struggling' then 6
        else 10
      end
    );

    update public.providers
    -- total_profit is kept equal to the sum of the trader's visible closed
    -- trades by signals_maintain_provider_profit (0218), not here.
    set total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta)),
        account_capital = greatest(50, coalesce(account_capital, 0) + v_pnl - v_withdrawal_bump),
        total_volume = coalesce(total_volume, 0) + round((v_lot_size * v_signal.entry_price)::numeric, 2),
        min_copy_amount = case
          when random() < 0.015 then
            greatest(200, min_copy_amount + (case when random() < 0.5 then 1 else -1 end) * (50 * (1 + floor(random() * 3)::int)))
          else min_copy_amount
        end
    where id = v_signal.provider_id;

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
  -- signals_integrity_guard rejects inconsistent writes; a rejected write
  -- skips this provider for this tick instead of failing the whole run.
  begin
    if v_provider.trading_status = 'stopped' then
      continue;
    end if;

    if v_provider.risk_archetype = 'high_risk' then
      v_margin_call := coalesce(v_provider.account_capital, 0) < 200 or random() < 0.000023;

      if v_margin_call then
        if public.sim_margin_call_close(v_provider.id, v_provider.account_capital, true) > 0 then
          v_new_margin_count := v_provider.margin_call_count + 1;
          v_recover_prob := case when v_new_margin_count = 1 then 0.70 when v_new_margin_count = 2 then 0.50 else 0.25 end;

          if random() < v_recover_prob then
            update public.providers
            set account_capital = round(500 + random() * 14500)::numeric,
                trading_status = 'active',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count,
                base_followers_count = 0
            where id = v_provider.id;
          else
            update public.providers
            set account_capital = round(coalesce(v_provider.account_capital, 0) * (0.01 + random() * 0.04), 2),
                trading_status = 'stopped',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count,
                base_followers_count = 0
            where id = v_provider.id;
          end if;

          continue;
        end if;

        perform public.sim_margin_call_close(v_provider.id, v_provider.account_capital, false);

        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
        if v_symbol = 'US30' then
          v_symbol := 'XAUUSD';
        end if;
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

    select exists (
      select 1 from public.subscriptions rsub
      join public.profiles rfp on rfp.id = rsub.follower_id
      where rsub.provider_id = v_provider.id and rsub.is_active = true
        and rfp.account_type = 'real' and rfp.balance > 0
        and rsub.copy_started_at is not null
        and now() - rsub.copy_started_at >= (
          (10 + abs(('x' || substr(md5(rsub.id::text), 1, 8))::bit(32)::int) % 21) || ' minutes'
        )::interval
    ) into v_has_real_follower;

    if v_has_real_follower then
      select count(*) into v_provider_open_count
      from public.signals where provider_id = v_provider.id and status = 'open';
      v_density_floor := 6 + floor(random() * 8)::int;
      if v_provider_open_count < v_density_floor then
        v_open_prob := least(1, v_open_prob + 0.35);
      end if;
    end if;

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

      if v_symbol = 'US30' then
        v_symbol := 'XAUUSD';
      end if;

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
          else v_pip_size := 1;
        end case;

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        case v_provider.risk_archetype
          when 'high_risk' then
            v_target_pips := 80 + random() * 220;
          when 'struggling' then
            v_target_pips := 50 + random() * 100;
          else
            -- Sporadic (swing/investor) gets a genuinely distant target
            -- (1-4% of price) instead of sharing the same modest
            -- 0.3-0.9% every other non-high-risk/struggling style used
            -- to share regardless of trading_style.
            if v_provider.trading_style = 'sporadic' then
              v_target_pips := (v_anchor * (0.010 + random() * 0.030)) / v_pip_size;
            else
              v_target_pips := (v_anchor * (0.003 + random() * 0.006)) / v_pip_size;
            end if;
        end case;

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

        case v_provider.risk_archetype
          when 'high_risk' then
            v_tp_pips := (v_anchor * (0.05 + random() * 0.10)) / v_pip_size;
          when 'struggling' then
            v_tp_pips := (v_anchor * (0.010 + random() * 0.035)) / v_pip_size;
          else
            if v_provider.trading_style = 'sporadic' then
              v_tp_pips := (v_anchor * (0.015 + random() * 0.045)) / v_pip_size;
            else
              v_tp_pips := (v_anchor * (0.004 + random() * 0.021)) / v_pip_size;
            end if;
        end case;
        case v_provider.risk_archetype
          when 'high_risk' then
            v_sl_pips := (v_anchor * (0.10 + random() * 0.15)) / v_pip_size;
          when 'struggling' then
            v_sl_pips := (v_anchor * (0.008 + random() * 0.027)) / v_pip_size;
          else
            if v_provider.trading_style = 'sporadic' then
              v_sl_pips := (v_anchor * (0.012 + random() * 0.028)) / v_pip_size;
            else
              v_sl_pips := (v_anchor * (0.003 + random() * 0.015)) / v_pip_size;
            end if;
        end case;
        if v_provider.risk_archetype in ('high_risk', 'struggling') then
          if v_is_win then
            v_sl_pips := v_sl_pips * (1.4 + random() * 0.8);
          else
            v_tp_pips := v_tp_pips * (1.4 + random() * 0.8);
          end if;
        else
          if v_is_win then
            v_sl_pips := least(v_sl_pips * (1.2 + random() * 0.3), (v_anchor * 0.035) / v_pip_size);
          else
            v_tp_pips := least(v_tp_pips * (1.2 + random() * 0.3), (v_anchor * 0.035) / v_pip_size);
          end if;
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
  exception when check_violation then
    raise warning 'run_market_simulation: provider % write rejected: %', v_provider.id, sqlerrm;
  end;
  end loop;
end;
$function$;

-- The 8 trades closed without a lot: nothing to recover it from, so flag
-- and hide (no invented value). Backup of their rows first.
create table public._bak_20261001c_signals_no_lot as
  select * from public.signals
  where status = 'closed' and lot_size is null and not needs_review and not created_by_admin;
alter table public._bak_20261001c_signals_no_lot enable row level security;
revoke all on public._bak_20261001c_signals_no_lot from anon, authenticated;
grant select on public._bak_20261001c_signals_no_lot to authenticated;
create policy _bak_20261001c_signals_no_lot_select_admin on public._bak_20261001c_signals_no_lot
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

set local app.trade_review_flagging = 'on';

insert into public.trade_audit_log (table_name, row_id, field, old_value, new_value, reason)
select 'signals', id, 'needs_review', 'false', 'true', 'missing_lot_size (margin-call close, not recoverable)'
from public._bak_20261001c_signals_no_lot
union all
select 'signals', id, 'hidden', 'false', 'true', 'broken:missing_lot_size'
from public._bak_20261001c_signals_no_lot;

update public.signals s
set needs_review = true, review_reasons = array['missing_lot_size'], hidden = true
from public._bak_20261001c_signals_no_lot b
where b.id = s.id;

commit;

refresh materialized view public.provider_performance_mv;
