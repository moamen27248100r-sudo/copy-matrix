-- ============================================================
-- Copy Matrix — permanent per-leader trading-style engine.
--
-- Every provider now has a persistent `trading_style` (scalper /
-- session_trader / moderate / sporadic) that drives:
--   1. Trade FREQUENCY: the old OPEN block sampled just 5-14 of the
--      1,924 providers per gated tick, capping any single leader to
--      ~1.5 chances/day no matter how the coin-flips were tuned. This
--      is replaced with an unconditional per-tick scan where EACH
--      provider gets its own per-minute probability derived from its
--      style, so styles can actually hit realistic daily targets
--      (scalper 20+/day, session_trader 1-2/day in-session, moderate
--      ~5/day, sporadic a low mean that naturally produces zero-trade
--      days).
--   2. Trade DURATION/MAGNITUDE: scalpers close in 3-20 minutes on
--      small pip moves (both the fabricated-fallback move and the
--      real-price path, which is now capped so real market swings
--      don't blow through a "quick scalp" trade).
--   3. Win/loss magnitude asymmetry, driven by `skill`, now applies
--      consistently across flagship/stable/high_risk/balanced (not
--      just good_rr/struggling, which already had it and are
--      untouched here).
--
-- Admin manual "margin call" trades are entirely separate (their own
-- insert+close in one server action) and are unaffected.
-- ============================================================

alter table public.providers
  add column if not exists trading_style text not null default 'moderate'
  check (trading_style in ('scalper', 'session_trader', 'moderate', 'sporadic'));

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dow int;
  v_month_day text;
  v_market_closed boolean;
  v_current_hour int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_crypto_symbols text[] := array['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
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
  v_in_session boolean;
  v_target_pips numeric;
  v_target_distance numeric;
  v_lagged_entry numeric;
  v_skill_rr numeric;
  v_scalp_pip_cap numeric;
  v_window_minutes int;
  v_micro numeric;
  v_open_prob numeric;
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
    select s.id, s.provider_id, s.side, s.entry_price, s.symbol, s.opened_at,
      coalesce(p.skill, 0.55) as skill, p.display_name,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      coalesce(p.trading_style, 'moderate') as trading_style,
      p.rr_ratio, p.account_capital
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (
        case
          when p.trading_style = 'scalper'
            then (floor(random() * 17 + 3) || ' minutes')::interval
          when p.risk_archetype = 'high_risk' and p.display_name not in ('أنس ريان', 'يوسف علي')
            then (floor(random() * 2880 + 1440) || ' minutes')::interval
          else (floor(random() * 180 + 30) || ' minutes')::interval
        end
      )
      and (not v_market_closed or s.symbol = any(v_crypto_symbols))
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_archetype := case when v_signal.display_name in ('أنس ريان', 'يوسف علي') then 'flagship' else v_signal.risk_archetype end;

    -- Continuous skill-derived win/loss magnitude tilt, applied to the
    -- archetypes that were previously flat/symmetric. good_rr and
    -- struggling already have their own real asymmetry and are left
    -- untouched. Clamped to a modest [0.5, 2.2] range so it stays a
    -- gentle lean, not a dominant effect over the archetype's own
    -- character.
    v_skill_rr := greatest(0.5, least(2.2, 1.0 + (coalesce(v_signal.skill, 0.55) - 0.5) * 2.4));

    case v_archetype
      when 'flagship' then
        v_base_loss := 0.005 + random() * 0.010;
        v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
        v_follower_cap := 2300;
      when 'stable' then
        v_base_loss := 0.005 + random() * 0.010;
        v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
        v_follower_cap := 520;
      when 'good_rr' then
        v_base_loss := 0.01 + random() * 0.03;
        v_move := case when v_is_win then v_base_loss * coalesce(v_signal.rr_ratio, 2.5) else v_base_loss end;
        v_follower_cap := 520;
      when 'high_risk' then
        v_base_loss := 0.05 + random() * 0.20;
        v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
        v_follower_cap := 2300;
      when 'struggling' then
        v_move := case when v_is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end;
        v_follower_cap := 60;
      else
        v_base_loss := 0.010 + random() * 0.020;
        v_move := case when v_is_win then v_base_loss * v_skill_rr else v_base_loss end;
        v_follower_cap := 520;
    end case;

    -- Scalpers: shrink the fabricated-fallback move so a trade that
    -- never got real price_history coverage still resolves small.
    if v_signal.trading_style = 'scalper' then
      v_move := v_move * (0.15 + random() * 0.15);
    end if;

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

    -- Pip size lookup, moved ahead of the old position so the scalper
    -- cap below can use it before lot sizing.
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

    -- Scalpers using the real-price path can otherwise inherit an
    -- arbitrarily large market swing over their (short) hold window —
    -- clamp so a "scalp" always resolves as a small, quick move. Keeps
    -- the same direction (so win/loss is unaffected), just shrinks the
    -- distance, which then correctly flows into a larger lot size below.
    if v_used_real and v_signal.trading_style = 'scalper' then
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

  -- OPEN block: every provider gets its own per-minute opening
  -- probability derived from its trading_style, instead of the old
  -- outer gate + small reservoir-sampled pool. At 1,924 rows this full
  -- scan is trivial every minute.
  for v_provider in
    select id, symbol_bias, session_start_hour, session_end_hour,
      coalesce(risk_archetype, 'balanced') as risk_archetype,
      coalesce(trading_style, 'moderate') as trading_style,
      coalesce(activity_weight, 1) as activity_weight
    from public.providers
  loop
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
        -- session_trader with no window assigned (shouldn't happen
        -- post-backfill) — stay safe rather than silently trading
        -- around the clock.
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

        -- Scalpers react to a small recent move, not a big one — this
        -- overrides whatever the risk_archetype's own range gave above.
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
          -- No real coverage with that much movement behind it (US30,
          -- or a genuine gap) — fall back to a jittered live price.
          v_entry := round((v_anchor * (1 + (random() - 0.5) * 0.01))::numeric, 4);
        end if;

        v_side := case when random() < 0.5 then 'buy' else 'sell' end;
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
      end if;
    end if;
  end loop;
end;
$function$;
