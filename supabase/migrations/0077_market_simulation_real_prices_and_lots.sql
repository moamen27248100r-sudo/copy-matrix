-- ============================================================
-- Copy Matrix — future trades now follow the exact same real-price
-- system the historical backfill just applied to the existing 241K:
--   - the skill-rolled win/loss decision is kept exactly as before
--     (preserves every tuned archetype's win rate) but the SIDE is now
--     chosen at close time to match real price direction over the
--     trade's actual elapsed window (price_history, kept growing every
--     minute by 0076) instead of fabricating a price move to match a
--     pre-chosen side.
--   - exit price is the real extreme price_history reached in that
--     window in the needed direction, when real data covers it; a
--     signal with no real coverage (US30, or a genuine data gap) falls
--     back to the previous fabricated-move formula so the engine can
--     never stall.
--   - high_risk trades get a longer aging window (1-3 days instead of
--     30-210 minutes) so real markets have a chance to produce a
--     bigger move, same reasoning as the historical backfill.
--   - lot_size is now computed per trade from the provider's own
--     account_capital and the real pip distance (mirrors
--     src/lib/pip-specs.ts), replacing the flat $2000 notional used
--     for every single trade regardless of who they are.
--
-- Cron cadence also moves from a fixed */5 min batch to every minute
-- with the opening step gated behind a ~20% per-tick chance (same
-- overall daily volume, timing spread across the day instead of
-- landing on a rigid 5-minute rhythm).
-- ============================================================

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dow int;
  v_month_day text;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
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
  v_used_real boolean;
begin
  v_dow := extract(dow from now());
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  v_month_day := to_char(now(), 'MM-DD');
  if v_month_day in ('01-01', '12-25') then
    return;
  end if;

  for v_signal in
    select s.id, s.provider_id, s.side, s.entry_price, s.symbol, s.opened_at,
      coalesce(p.skill, 0.55) as skill, p.display_name,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      p.rr_ratio, p.account_capital
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (
        case
          when p.risk_archetype = 'high_risk' and p.display_name not in ('أنس ريان', 'يوسف علي')
            then (floor(random() * 2880 + 1440) || ' minutes')::interval
          else (floor(random() * 180 + 30) || ' minutes')::interval
        end
      )
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_archetype := case when v_signal.display_name in ('أنس ريان', 'يوسف علي') then 'flagship' else v_signal.risk_archetype end;

    case v_archetype
      when 'flagship' then
        v_move := case when v_is_win then 0.008 + random() * 0.014 else 0.005 + random() * 0.010 end;
        v_follower_cap := 2300;
      when 'stable' then
        v_move := 0.005 + random() * 0.015;
        v_follower_cap := 520;
      when 'good_rr' then
        v_base_loss := 0.01 + random() * 0.03;
        v_move := case when v_is_win then v_base_loss * coalesce(v_signal.rr_ratio, 2.5) else v_base_loss end;
        v_follower_cap := 520;
      when 'high_risk' then
        v_move := 0.05 + random() * 0.30;
        v_follower_cap := 2300;
      when 'struggling' then
        v_move := case when v_is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end;
        v_follower_cap := 60;
      else
        v_move := 0.010 + random() * 0.040;
        v_follower_cap := 520;
    end case;

    -- Try the real-price path first: does price_history actually cover
    -- this signal's real elapsed window for its symbol?
    v_used_real := false;

    select
      (select price from public.price_history where symbol = v_signal.symbol and ts >= v_signal.opened_at order by ts desc limit 1) > v_signal.entry_price
    into v_trend_up;

    if v_trend_up is not null then
      v_side := case when (v_trend_up and v_is_win) or ((not v_trend_up) and (not v_is_win)) then 'buy' else 'sell' end;
      select case when v_trend_up then max(price) else min(price) end into v_exit_price
      from public.price_history where symbol = v_signal.symbol and ts between v_signal.opened_at and now();

      if v_exit_price is not null and v_exit_price <> v_signal.entry_price then
        v_used_real := true;
      end if;
    end if;

    if not v_used_real then
      -- No real coverage for this symbol/window (US30, or a genuine
      -- gap) — fall back to the original fabricated-move formula so
      -- the engine never stalls.
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_exit_price := round(
        case
          when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
            then v_signal.entry_price * (1 + v_move)
          else v_signal.entry_price * (1 - v_move)
        end,
        4
      );
    end if;

    -- Lot size from this provider's own capital + the real pip
    -- distance, mirroring src/lib/pip-specs.ts.
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
      v_pnl := round((v_notional * v_move * (case when v_is_win then 1 else -1 end))::numeric, 2);
    end if;

    update public.signals
    set status = 'closed',
        side = v_side,
        exit_price = v_exit_price,
        lot_size = v_lot_size,
        closed_at = now()
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

    update public.providers
    set total_profit = total_profit + v_pnl,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta))
    where id = v_signal.provider_id;
  end loop;

  -- Opening stays gated behind a per-tick chance so moving to a
  -- 1-minute cron doesn't multiply total daily trade volume — it just
  -- spreads the same volume across more, smaller, randomly-timed ticks
  -- instead of one rigid batch every 5 minutes.
  if random() < 0.2 then
    for v_provider in
      select id, symbol_bias from public.providers order by random() limit (5 + floor(random() * 10)::int)
    loop
      if random() < 0.4 then
        if v_provider.symbol_bias is not null then
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
        v_symbol_idx := array_position(v_symbols, v_symbol);

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        v_side := case when random() < 0.5 then 'buy' else 'sell' end;
        v_entry := round((v_anchor * (1 + (random() - 0.5) * 0.01))::numeric, 4);
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
      end if;
    end loop;
  end if;
end;
$function$;
