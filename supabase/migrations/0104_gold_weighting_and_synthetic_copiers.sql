-- ============================================================
-- Copy Matrix — two changes:
--
-- 1. Gold (XAUUSD) becomes the dominant traded symbol platform-wide:
--    a 60% outer roll forces the OPEN block's symbol pick to XAUUSD,
--    falling through to the existing symbol_bias/random logic for
--    the other 40% (which can itself land on gold too, so the
--    realized share settles around 60-63%). Forward-only — no
--    rewrite of historical signals.
--
-- 2. New public.synthetic_customers table: gives the previously
--    faceless base_followers_count padding number real per-row
--    identity (distinct name/capital/join date per leader), with
--    capital that compounds live off the leader's own real trade
--    P&L from each customer's own join date forward — mirroring how
--    real copy-trading (mirror_signal_to_followers) only mirrors NEW
--    signals after a follower joins, just made visible. Purely
--    decorative/synthetic — no FK to profiles/subscriptions, no
--    relation to real user accounts.
-- ============================================================

create table public.synthetic_customers (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  display_name text not null,
  starting_capital numeric not null check (starting_capital > 0),
  current_capital numeric not null check (current_capital >= 0),
  joined_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index synthetic_customers_provider_joined_idx
  on public.synthetic_customers (provider_id, joined_at);

alter table public.synthetic_customers enable row level security;

create policy "synthetic_customers_select_all" on public.synthetic_customers
  for select to authenticated using (true);

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
  v_margin_call boolean;
  v_new_margin_count int;
  v_recover_prob numeric;
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

    v_skill_rr := greatest(0.6, least(5.0, 3.0 + (coalesce(v_signal.skill, 0.55) - 0.55) * 6.667));

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

    if v_signal.trading_style = 'scalper' then
      v_move := v_move * (0.15 + random() * 0.15);
    end if;

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

    if v_signal.trading_style = 'scalper' then
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
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta)),
        account_capital = greatest(50, coalesce(account_capital, 0) + v_pnl - v_withdrawal_bump)
    where id = v_signal.provider_id;

    -- Synthetic customers compound in lockstep with the leader's own
    -- capital, using the same % basis v_pnl was computed against, but
    -- only for customers who had already "joined" before this trade
    -- opened (mirrors how real copy-trading only mirrors NEW signals
    -- after a follower joins).
    update public.synthetic_customers
    set current_capital = greatest(
      10,
      round(
        (current_capital * (1 + v_pnl / greatest(coalesce(v_signal.account_capital, v_notional), 1)))::numeric,
        2
      )
    )
    where provider_id = v_signal.provider_id
      and joined_at <= v_signal.opened_at;
  end loop;

  for v_provider in
    select id, symbol_bias, session_start_hour, session_end_hour,
      coalesce(risk_archetype, 'balanced') as risk_archetype,
      coalesce(trading_style, 'moderate') as trading_style,
      coalesce(activity_weight, 1) as activity_weight,
      account_capital,
      coalesce(trading_status, 'active') as trading_status,
      coalesce(margin_call_count, 0) as margin_call_count
    from public.providers
  loop
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
            is_margin_call = true
        where s.provider_id = v_provider.id and s.status = 'open';

        if not found then
          v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
          v_side := case when random() < 0.5 then 'buy' else 'sell' end;

          select price into v_anchor from public.market_prices where symbol = v_symbol;
          if v_anchor is null then
            v_symbol_idx := array_position(v_symbols, v_symbol);
            v_anchor := v_base_prices[v_symbol_idx];
          end if;

          insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at, lot_size, is_margin_call)
          values (
            v_provider.id, v_symbol, v_side, v_anchor,
            round((v_anchor * (case when v_side = 'buy' then 1 - (0.20 + random() * 0.20) else 1 + (0.20 + random() * 0.20) end))::numeric, 4),
            'closed', now() - interval '5 minutes', now(), 0.01, true
          );
        end if;

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
        -- Gold is the dominant instrument platform-wide, regardless
        -- of the leader's own symbol_bias.
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
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
      end if;
    end if;
  end loop;
end;
$function$;

create or replace view public.provider_cards as
with vol_pop as (
  select perf.provider_id, perf.return_volatility
  from public.provider_performance perf
  where perf.closed_signals >= 5 and perf.return_volatility is not null
),
vol_bounds as (
  select count(*) as n,
    percentile_cont(0.33) within group (order by return_volatility) as p33,
    percentile_cont(0.66) within group (order by return_volatility) as p66
  from vol_pop
)
select
  p.id as provider_id,
  p.bio,
  coalesce(pr.display_name, p.display_name) as display_name,
  coalesce(pf.followers_count, 0) + p.base_followers_count as followers_count,
  coalesce(perf.open_signals, 0) as open_signals,
  coalesce(perf.closed_signals, 0) as closed_signals,
  perf.win_rate_pct,
  perf.avg_return_pct,
  p.created_at as joined_at,
  p.total_profit,
  p.total_withdrawals,
  p.min_copy_amount,
  coalesce(perf.return_volatility, 2) as return_volatility,
  case
    when coalesce(perf.closed_signals, 0) < 5 then 'متوسطة'
    when vb.n < 30 then
      case
        when coalesce(perf.return_volatility, 2) < 3 then 'منخفضة'
        when coalesce(perf.return_volatility, 2) < 10 then 'متوسطة'
        else 'مرتفعة'
      end
    when perf.return_volatility < vb.p33 then 'منخفضة'
    when perf.return_volatility < vb.p66 then 'متوسطة'
    else 'مرتفعة'
  end as risk_level,
  round(greatest(0, least(100,
    45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
      (
        coalesce(perf.win_rate_pct, 50) * 0.6
        + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
        + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
      ) - 45
    )
  ))) as rating_score,
  case
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 75 then 'نخبة'
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 55 then 'محترف'
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 35 then 'متوسط'
    else 'مبتدئ'
  end as tier,
  perf.avg_daily_return_pct,
  p.country,
  p.account_capital,
  p.trading_status,
  p.margin_called_at
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id
cross join vol_bounds vb;
