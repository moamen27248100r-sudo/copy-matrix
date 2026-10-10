-- The live engine trades the v3 leader strategies the history rebuild (version 3) uses:
-- a trend lookback (tlb) beside the short one, and the trend / breakout / reversion
-- conditions of scripts/sim/engine.mjs signalDir -- a chance whose condition isn't met
-- opens nothing, and chances arrive 1 / (1 - follow / 2) times as often so the leader
-- keeps its profile's trades per day. Prices are past ticks only (price_history at or
-- before now). v2 personas keep the previous rule.
-- Rollback: the definitions in 0250 (sim_open_trade) and 0248 (run_market_simulation).

begin;

CREATE OR REPLACE FUNCTION public.run_market_simulation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_hour int := extract(hour from now() at time zone 'UTC')::int;
  v_weekend boolean := extract(dow from now() at time zone 'UTC') in (0, 6);
  r record;
  v_w numeric;
begin
  if not pg_try_advisory_xact_lock(hashtext('run_market_simulation')) then
    return;
  end if;

  for r in
    select s.id from public.signals s
    join public.sim_trade_plans pl on pl.signal_id = s.id
    where s.status = 'open'
    order by s.opened_at
  loop
    perform public.sim_advance_trade(r.id);
  end loop;

  for r in
    select p.id, p.persona,
           (select count(*) from public.signals s where s.provider_id = p.id and s.status = 'open' and not s.hidden) as open_n
    from public.providers p
    where p.is_simulated and p.persona is not null and not p.is_archived and coalesce(p.trading_status, 'active') = 'active'
  loop
    v_w := public.sim_session_weight(r.persona, v_hour);
    continue when v_w = 0;
    continue when v_weekend and not coalesce((r.persona ->> 'weekend')::boolean, false);
    continue when r.open_n >= coalesce((r.persona ->> 'max_open')::int, 1);
    -- v3 strategies skip about half of their signal-led chances, so chances come
    -- 1 / (1 - follow / 2) times as often (engine.mjs filterRateFactor).
    continue when random() >= (r.persona ->> 'tpd')::numeric / public.sim_session_minutes(r.persona) * v_w
      * (case when r.persona ? 'tlb' then 1 / (1 - 0.5 * (r.persona ->> 'follow')::numeric) else 1 end);
    perform public.sim_open_trade(r.id);
  end loop;

  perform public.refresh_dirty_provider_stats();
end $function$;

create or replace function public.sim_open_trade(p_provider_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare
  pr record;
  p jsonb;
  v_now timestamptz := now();
  lim_day numeric;
  lim_nlo numeric; lim_nhi numeric; lim_xlo numeric; lim_xhi numeric;
  v_day record;
  v_day_ret numeric := 0;
  v_month_ret numeric;
  v_extreme boolean;
  v_exposure numeric;
  v_rr numeric;
  v_mult numeric;
  v_symbol text;
  v_roll numeric;
  v_acc numeric;
  a record;
  sym record;
  v_live numeric;
  v_then numeric;
  v_long numeric;
  v_s int;
  v_l int;
  v_coin numeric;
  v_follow numeric;
  v_hold int;
  v_half numeric;
  v_entry numeric;
  v_sl_dist numeric;
  v_tp_dist numeric;
  v_dir int;
  v_risk_usd numeric;
  v_lot numeric;
  v_max_lot numeric;
  v_units numeric;
  v_id uuid;
begin
  select * into pr from public.providers where id = p_provider_id;
  p := pr.persona;
  if p is null or coalesce(pr.account_capital, 0) <= 0 or p ->> 'lb' is null then return false; end if;

  lim_day := case p ->> 'risk' when 'low' then 0.03 when 'medium' then 0.07 else 0.18 end;
  select n_lo, n_hi, x_lo, x_hi into lim_nlo, lim_nhi, lim_xlo, lim_xhi from (values
    ('low', -0.06, 0.06, -0.10, 0.10), ('medium', -0.12, 0.15, -0.20, 0.25), ('high', -0.30, 0.40, -0.45, 0.60)
  ) v(k, n_lo, n_hi, x_lo, x_hi) where k = p ->> 'risk';

  -- Daily / monthly brakes on the realised result.
  select * into v_day from public.provider_daily where provider_id = p_provider_id and day = (v_now at time zone 'UTC')::date;
  if found and v_day.start_equity + v_day.cash_flow > 0 then
    v_day_ret := v_day.pnl / (v_day.start_equity + v_day.cash_flow);
  end if;
  if abs(v_day_ret) >= lim_day * 0.7 then return false; end if;
  select exp(coalesce(sum(ln(greatest(1e-9, 1 + case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end))), 0)) - 1
    into v_month_ret from public.provider_daily
    where provider_id = p_provider_id and day >= date_trunc('month', v_now at time zone 'UTC')::date;
  if v_month_ret <= lim_xlo * 0.85 or v_month_ret >= lim_xhi * 0.85 then return false; end if;
  if v_month_ret <= lim_nlo * 0.9 or v_month_ret >= lim_nhi * 0.9 then
    if p ->> 'risk' <> 'high' then return false; end if;
    select exists (
      select 1 from (
        select date_trunc('month', day) m,
               exp(sum(ln(greatest(1e-9, 1 + case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end)))) - 1 r
        from public.provider_daily
        where provider_id = p_provider_id and day >= date_trunc('year', v_now at time zone 'UTC')::date
          and day < date_trunc('month', v_now at time zone 'UTC')::date
        group by 1) x
      where x.r < lim_nlo or x.r > lim_nhi) into v_extreme;
    if v_extreme then return false; end if;
  end if;

  -- Open risk stays inside the daily limit.
  v_rr := greatest(1, (p ->> 'rr')::numeric);
  select coalesce(sum(pl.risk_pct), 0) * v_rr into v_exposure
  from public.signals s join public.sim_trade_plans pl on pl.signal_id = s.id
  where s.provider_id = p_provider_id and s.status = 'open' and not s.hidden;
  if v_exposure + (p ->> 'risk_pct')::numeric * v_rr
     > lim_day * 100 * (case p ->> 'style' when 'swing' then 1.25 when 'position' then 1.2 else 0.85 end) then
    return false;
  end if;

  v_mult := public.sim_drawdown_brake(p_provider_id, p, v_day_ret);
  if v_mult = 0 then return false; end if;

  -- Symbol by the persona's weights (the daily-only pairs for multi-day styles).
  v_roll := random() * (
    select sum(value::numeric) from jsonb_each_text(p -> 'assets')
    where key not in ('GBPUSD', 'USDJPY') or p ->> 'style' in ('swing', 'position'));
  v_acc := 0;
  for a in select key, value::numeric w from jsonb_each_text(p -> 'assets')
           where key not in ('GBPUSD', 'USDJPY') or p ->> 'style' in ('swing', 'position') order by key loop
    v_acc := v_acc + a.w;
    v_symbol := a.key;
    exit when v_roll <= v_acc;
  end loop;
  if v_symbol is null or not public.sim_market_open(v_symbol, v_now) then return false; end if;
  select * into sym from public.sim_symbols where symbol = v_symbol;
  -- Scalpers and day traders don't open into a market that closes within 30 minutes.
  if sym.kind <> 'crypto' and p ->> 'style' in ('scalper', 'day')
     and not public.sim_market_open(v_symbol, v_now + interval '30 minutes') then
    return false;
  end if;
  -- The last price recorded at or before this run's time (never one recorded later).
  select price into v_live from public.price_history
    where symbol = v_symbol and ts <= v_now and ts > v_now - interval '5 minutes' order by ts desc limit 1;
  if v_live is null or v_live <= 0 then return false; end if;
  v_live := round(v_live, sym.dp::int);

  -- Direction from past prices only (engine.mjs signalDir). v3 personas (with a
  -- trend lookback tlb): trend = the long trend's side on a pullback, breakout =
  -- when the short and long moves agree, reversion = against an over-extended
  -- move; no trade when the condition isn't met. v2: follow / fade the short move.
  select price into v_then from public.price_history
    where symbol = v_symbol and ts <= v_now - make_interval(mins => (p ->> 'lb')::int) order by ts desc limit 1;
  v_coin := random();
  v_follow := random();
  if p ? 'tlb' then
    if v_follow < (p ->> 'follow')::numeric then
      select price into v_long from public.price_history
        where symbol = v_symbol and ts <= v_now - make_interval(mins => (p ->> 'tlb')::int) order by ts desc limit 1;
      if v_then is null or v_long is null then return false; end if;
      v_s := sign(v_live - round(v_then, sym.dp::int));
      v_l := sign(v_live - round(v_long, sym.dp::int));
      if v_s = 0 or v_l = 0 then return false; end if;
      v_dir := case p ->> 'strat'
        when 'trend' then case when v_s = -v_l then v_l else 0 end
        when 'breakout' then case when v_s = v_l then v_l else 0 end
        else case when v_s = v_l then -v_s else 0 end end;
      if v_dir = 0 then return false; end if;
    else
      v_dir := case when v_coin < 0.5 then 1 else -1 end;
    end if;
  elsif v_then is not null and v_follow < (p ->> 'follow')::numeric and round(v_then, sym.dp::int) <> v_live then
    v_dir := case when v_live > round(v_then, sym.dp::int) then 1 else -1 end
             * case when p ->> 'strat' = 'reversion' then -1 else 1 end;
  else
    v_dir := case when v_coin < 0.5 then 1 else -1 end;
  end if;

  v_hold := greatest(1, round(exp(ln((p -> 'hold' ->> 0)::numeric) + random() * (ln((p -> 'hold' ->> 1)::numeric) - ln((p -> 'hold' ->> 0)::numeric)))))::int;
  v_half := public.sim_half_spread(v_symbol, v_live);
  v_entry := v_live + v_dir * v_half;
  v_sl_dist := v_entry * sym.sigma_h * sqrt(greatest(v_hold, 5) / 60.0) * (p ->> 'k_sl')::numeric * (0.8 + random() * 0.45);
  v_sl_dist := greatest(v_sl_dist, sym.pip * (case when sym.kind = 'crypto' then 5 else 8 end), v_entry * 0.0004);
  v_tp_dist := v_sl_dist * (p ->> 'rr')::numeric * (0.85 + random() * 0.33);
  v_sl_dist := round(v_sl_dist, sym.dp::int);
  v_tp_dist := round(v_tp_dist, sym.dp::int);
  v_units := sym.val / sym.pip;
  v_risk_usd := pr.account_capital * (p ->> 'risk_pct')::numeric / 100 * v_mult * (0.85 + random() * 0.3);
  v_lot := floor(v_risk_usd / (v_sl_dist * v_units) / sym.step) * sym.step;
  v_max_lot := floor(pr.account_capital * (p ->> 'lev')::numeric / public.sim_notional(v_symbol, 1, v_entry) / sym.step) * sym.step;
  v_lot := least(v_lot, v_max_lot);
  if v_lot < sym.step then
    if sym.step * v_sl_dist * v_units > v_risk_usd * 3 then return false; end if;
    v_lot := sym.step;
  end if;

  insert into public.signals (provider_id, symbol, side, entry_price, stop_loss, take_profit, lot_size, status, opened_at)
  values (p_provider_id, v_symbol, case when v_dir > 0 then 'buy' else 'sell' end, v_entry,
          v_entry - v_dir * v_sl_dist, v_entry + v_dir * v_tp_dist, round(v_lot, 3), 'open', v_now)
  returning id into v_id;

  insert into public.sim_trade_plans (signal_id, hold_min, risk_pct, equity_at_open, planned_close_at, next_check_at, checked_at)
  values (v_id, v_hold, round(v_lot * v_sl_dist * v_units * 100 / pr.account_capital, 4), pr.account_capital,
          v_now + make_interval(mins => v_hold), v_now + make_interval(mins => v_hold), v_now);
  return true;
exception when check_violation then
  raise warning 'sim_open_trade: provider % rejected: %', p_provider_id, sqlerrm;
  return false;
end $$;

commit;
