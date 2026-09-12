-- ============================================================
-- Copy Matrix — correction to the density mechanic (0126/0127): it
-- should NOT start the instant a real customer clicks "copy". A trade
-- appearing in the same second as the subscribe click reads as
-- obviously scripted, not organic. Reverted the immediate RPC call
-- from src/app/discover/actions.ts entirely -- seeding is now driven
-- purely by the engine's own periodic tick, gated by a per-subscription
-- randomized start delay computed inside seed_density_for_follower()
-- itself (10-30 minutes, deterministic from the subscription's own id
-- so it's stable across ticks but varies customer to customer -- no
-- single fixed wait time for anyone to notice).
--
-- This range deliberately overlaps the existing copy_started_at grace
-- period used elsewhere (withdrawal lock, amount-edit lock -- both key
-- off "10 minutes since copy started"), so by the time those locks
-- engage, real open positions already exist to back them up instead of
-- the lock message being true only by coincidence.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_density_for_follower(p_follower_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_crypto_symbols text[] := array['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider_id uuid;
  v_allocated_amount numeric;
  v_subscription_id uuid;
  v_copy_started_at timestamptz;
  v_start_delay_minutes int;
  v_dow int;
  v_current_hour int;
  v_month_day text;
  v_market_closed boolean;
  v_leader_open_count int;
  v_density_current int;
  v_density_target int;
  v_density_i int;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_anchor numeric;
  v_entry numeric;
  v_pip_size numeric;
  v_offset_points numeric;
  v_tp_pips numeric;
  v_sl_pips numeric;
  v_roll numeric;
  v_bucket text;
  v_density_signal_id uuid;
  v_density_opened_at timestamptz;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_follower_id then
    return;
  end if;

  select sub.id, sub.provider_id, coalesce(sub.allocated_amount, 500), sub.copy_started_at
  into v_subscription_id, v_provider_id, v_allocated_amount, v_copy_started_at
  from public.subscriptions sub
  where sub.follower_id = p_follower_id and sub.is_active = true
  limit 1;

  if v_provider_id is null then
    return;
  end if;

  -- Deliberately NOT immediate -- a trade appearing the same instant
  -- someone clicks "copy" reads as scripted. Each subscription gets its
  -- own 10-30 minute start delay (deterministic from the subscription's
  -- own id, so it doesn't shift between calls/ticks, but varies customer
  -- to customer -- no single fixed wait time to notice). Same range as
  -- the existing copy_started_at grace period elsewhere in the app, so
  -- by the time withdrawal/edits lock, real open positions already
  -- exist to back up that lock.
  v_start_delay_minutes := 10 + abs(('x' || substr(md5(v_subscription_id::text), 1, 8))::bit(32)::int) % 21;
  if v_copy_started_at is null or now() - v_copy_started_at < (v_start_delay_minutes || ' minutes')::interval then
    return;
  end if;

  v_dow := extract(dow from now());
  v_month_day := to_char(now(), 'MM-DD');
  v_current_hour := extract(hour from now())::int;
  v_market_closed := (
    v_dow = 6
    or (v_dow = 0 and v_current_hour < 22)
    or (v_dow = 5 and v_current_hour >= 22)
    or v_month_day in ('01-01', '12-25')
  );

  select count(*) into v_leader_open_count
  from public.signals
  where provider_id = v_provider_id and status = 'open' and not created_by_admin;

  select count(*) into v_density_current
  from public.simulated_positions sp
  join public.signals s2 on s2.id = sp.signal_id
  where sp.follower_id = p_follower_id
    and sp.status = 'open'
    and s2.created_by_admin = true;

  -- always at least leader_count + 8, so "even more than the leader"
  -- holds even when the leader currently has zero open signals.
  v_density_target := v_leader_open_count + 8 + floor(random() * 12)::int;

  if v_density_current >= v_density_target then
    return;
  end if;

  -- capped at 3 per call: a gradual build-up across the engine's own
  -- ticks once the start delay has passed, rather than a single burst
  -- insert.
  for v_density_i in 1..least(v_density_target - v_density_current, 3) loop
    if v_market_closed then
      v_symbol := v_crypto_symbols[1 + floor(random() * array_length(v_crypto_symbols, 1))::int];
    elsif random() < 0.6 then
      v_symbol := 'XAUUSD';
    else
      v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
    end if;

    select price into v_anchor from public.market_prices where symbol = v_symbol;
    if v_anchor is null then
      v_symbol_idx := array_position(v_symbols, v_symbol);
      v_anchor := v_base_prices[v_symbol_idx];
    end if;

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

    -- variable delayed-entry offset: a real copy fill rarely lands at
    -- the exact live tick price -- a randomized point offset (either
    -- direction) keeps that natural instead of every position opening
    -- at a suspiciously identical price.
    v_offset_points := (array[30, 50, 100, 200])[1 + floor(random() * 4)::int];
    v_entry := round((
      v_anchor + v_offset_points * v_pip_size * (case when random() < 0.5 then 1 else -1 end)
    )::numeric, 4);

    v_side := case when random() < 0.5 then 'buy' else 'sell' end;
    v_density_opened_at := now() - (floor(random() * 45) || ' minutes')::interval;

    v_tp_pips := 20 + random() * 40;
    v_sl_pips := 15 + random() * 30;
    v_roll := random();
    v_bucket := case
      when v_roll < 0.45 then 'both'
      when v_roll < 0.65 then 'tp_only'
      when v_roll < 0.85 then 'sl_only'
      else 'neither'
    end;

    insert into public.signals (
      provider_id, symbol, side, entry_price, status, opened_at,
      predetermined_win, created_by_admin, take_profit, stop_loss
    )
    values (
      v_provider_id, v_symbol, v_side, v_entry, 'open', v_density_opened_at,
      random() < 0.55, true,
      case when v_bucket in ('both', 'tp_only') then
        (case when v_side = 'buy' then round((v_entry + v_tp_pips * v_pip_size)::numeric, 4)
              else round((v_entry - v_tp_pips * v_pip_size)::numeric, 4) end)
        else null end,
      case when v_bucket in ('both', 'sl_only') then
        (case when v_side = 'buy' then round((v_entry - v_sl_pips * v_pip_size)::numeric, 4)
              else round((v_entry + v_sl_pips * v_pip_size)::numeric, 4) end)
        else null end
    )
    returning id into v_density_signal_id;

    insert into public.simulated_positions (signal_id, follower_id, entry_price, size, status, opened_at)
    values (
      v_density_signal_id, p_follower_id, v_entry,
      round((v_allocated_amount * (0.05 + random() * 0.15))::numeric, 2),
      'open', v_density_opened_at
    );
  end loop;
end;
$function$
