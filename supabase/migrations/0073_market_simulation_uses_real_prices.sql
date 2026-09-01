-- ============================================================
-- Copy Matrix — one surgical change to run_market_simulation(): new
-- signals now anchor their entry price to the real, live
-- market_prices row for that symbol (populated every minute by
-- fire_price_fetch_requests()/apply_price_fetch_responses(), see
-- 0072) instead of the hardcoded v_base_prices constant — falling
-- back to that same constant if market_prices has no row yet for a
-- symbol (US30, or any symbol before the first fetch tick), so this
-- can never break signal creation.
--
-- Every other part of the tuned archetype/skill/win-rate/follower
-- system (0055) is untouched — copied verbatim except for the one
-- entry-price line.
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
    select s.id, s.provider_id, s.side, s.entry_price,
      coalesce(p.skill, 0.55) as skill, p.display_name,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      p.rr_ratio
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
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

    update public.signals
    set status = 'closed',
        exit_price = round(
          case
            when (side = 'buy' and v_is_win) or (side = 'sell' and not v_is_win)
              then entry_price * (1 + v_move)
            else entry_price * (1 - v_move)
          end,
          4
        ),
        closed_at = now()
    where id = v_signal.id;

    v_pnl := round((v_notional * v_move * (case when v_is_win then 1 else -1 end))::numeric, 2);

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
end;
$function$;
