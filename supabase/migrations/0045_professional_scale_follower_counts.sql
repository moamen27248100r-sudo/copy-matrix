-- ============================================================
-- Copy Matrix — 0044 over-corrected: capping followers at 1-25
-- reads as a brand new, barely-used platform, not a professional
-- copy-trading platform. Real platforms in this space (eToro
-- Popular Investors, ZuluTrade, etc.) show ordinary providers with
-- copier counts in the tens to low hundreds, and standout/elite
-- providers in the high hundreds to low thousands — never single
-- digits, never tens of thousands.
--
-- This migration re-scales the same tenure x skill tier logic from
-- 0043/0044 to that middle-ground, professional-platform range, and
-- scales the live simulation's per-trade follower delta and caps to
-- match so it stays in this range indefinitely.
-- ============================================================

do $$
declare
  v_provider record;
  v_tenure_days numeric;
  v_is_flagship boolean;
  v_tier_min numeric;
  v_tier_max numeric;
  v_tenure_norm numeric;
  v_noise numeric;
  v_new_followers int;
begin
  for v_provider in
    select id, display_name, skill, created_at
    from public.providers
    where user_id is null
  loop
    v_tenure_days := greatest(1, extract(epoch from (now() - v_provider.created_at)) / 86400);
    v_is_flagship := v_provider.display_name in ('أنس ريان', 'يوسف علي');

    if v_is_flagship then
      v_tier_min := 600; v_tier_max := 2000;
    elsif v_provider.skill >= 0.65 then
      v_tier_min := 150; v_tier_max := 450;
    elsif v_provider.skill >= 0.50 then
      v_tier_min := 70; v_tier_max := 200;
    elsif v_provider.skill >= 0.35 then
      v_tier_min := 30; v_tier_max := 100;
    else
      v_tier_min := 10; v_tier_max := 50;
    end if;

    v_tenure_norm := least(1, v_tenure_days / 900.0);
    v_noise := 0.75 + random() * 0.5;
    v_new_followers := greatest(5, round(v_tier_min + (v_tier_max - v_tier_min) * v_tenure_norm * v_noise)::int);
    v_new_followers := least(v_new_followers, round(v_tier_max * 1.15)::int);

    update public.providers
    set base_followers_count = v_new_followers
    where id = v_provider.id;
  end loop;
end $$;

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
  v_move numeric;
  v_is_win boolean;
  v_is_flagship boolean;
  v_is_struggling boolean;
  v_notional numeric := 2000;
  v_pnl numeric;
  v_withdrawal_bump numeric;
  v_follower_delta int;
  v_follower_cap int;
  v_roll numeric;
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
      coalesce(p.skill, 0.55) as skill, p.display_name
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_is_flagship := v_signal.display_name in ('أنس ريان', 'يوسف علي');
    v_is_struggling := (not v_is_flagship) and v_signal.skill < 0.35;

    if v_is_flagship then
      v_move := case when v_is_win then 0.008 + random() * 0.014 else 0.005 + random() * 0.010 end;
      v_follower_cap := 2300;
    elsif v_is_struggling then
      v_move := case when v_is_win then 0.005 + random() * 0.015 else 0.020 + random() * 0.070 end;
      v_follower_cap := 60;
    else
      v_move := case when v_is_win then 0.010 + random() * 0.080 else 0.003 + random() * 0.022 end;
      v_follower_cap := 520;
    end if;

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

    -- Follower moves scale with tier so a win/loss actually registers
    -- at each leader's own scale, still hard-capped per tier so the
    -- range stays professional-platform-realistic long-term.
    v_follower_delta := case
      when v_is_win and random() < (case when v_is_flagship then 0.45 else 0.20 end)
        then 1 + floor(random() * (case when v_is_flagship then 6 else 3 end))::int
      when (not v_is_win) and v_is_struggling and random() < 0.28
        then -(1 + floor(random() * 2)::int)
      when (not v_is_win) and (not v_is_struggling) and random() < 0.07
        then -(1 + floor(random() * (case when v_is_flagship then 3 else 1 end))::int)
      else 0
    end;

    update public.providers
    set total_profit = total_profit + v_pnl,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(5, base_followers_count + v_follower_delta))
    where id = v_signal.provider_id;
  end loop;

  -- Open new signals, following each leader's own instrument bias.
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
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.01))::numeric, 4);
      insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
      values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
    end if;
  end loop;
end;
$function$;
