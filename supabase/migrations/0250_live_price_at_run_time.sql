-- Live engine prices are taken at the run's own time, and two leftovers from 0245.
-- Rollback: the definitions in 0248 (sim_open_trade) and 0246 (sim_advance_trade).
--
--  1. sim_open_trade / sim_advance_trade read the live price from market_prices, but a
--     run's now() is its transaction start: a run that waited on a lock (it did, behind the
--     history rebuild) read a price committed seconds later and stamped the trade with the
--     earlier time. They now take the last price_history tick at or before now(), so a
--     trade's time never precedes its price.
--  2. The three live closes made that way move to the time their price was recorded (same
--     UTC day, so the daily ledger and stats are unchanged).
--  3. 0245 revoked TRUNCATE / TRIGGER / REFERENCES from customers on tables only; the
--     provider_cards / provider_performance / provider_followers views kept them, and the
--     default privileges still grant them on every new table or view.

begin;

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

  -- Direction from the move over the lookback (past prices only).
  select price into v_then from public.price_history
    where symbol = v_symbol and ts <= v_now - make_interval(mins => (p ->> 'lb')::int) order by ts desc limit 1;
  v_coin := random();
  v_follow := random();
  if v_then is not null and v_follow < (p ->> 'follow')::numeric and round(v_then, sym.dp::int) <> v_live then
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

create or replace function public.sim_advance_trade(p_signal_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  s record;
  v_now timestamptz := now();
  v_dir int;
  v_half numeric;
  v_touch record;
  v_live numeric;
  v_kind text;
  v_dp int;
begin
  select g.id, g.symbol, g.side, g.entry_price, g.stop_loss, g.take_profit, g.opened_at, pl.*, pr.persona ->> 'style' as style
    into s
    from public.signals g
    join public.sim_trade_plans pl on pl.signal_id = g.id
    join public.providers pr on pr.id = g.provider_id
    where g.id = p_signal_id and g.status = 'open';
  if not found then return; end if;
  select kind, dp into v_kind, v_dp from public.sim_symbols where symbol = s.symbol;
  v_dir := public.trade_dir(s.side);
  v_half := public.sim_half_spread(s.symbol, s.entry_price);

  -- The first price since the last check whose exit side (bid for a buy, ask for a sell)
  -- reaches the stop or the target closes the trade at that level.
  select ts, price into v_touch from public.price_history
  where symbol = s.symbol and ts > greatest(s.checked_at, s.opened_at) and ts <= v_now
    and public.sim_market_open(s.symbol, ts)
    and ((price - v_dir * v_half - s.stop_loss) * v_dir <= 0 or (price - v_dir * v_half - s.take_profit) * v_dir >= 0)
  order by ts limit 1;
  if v_touch.ts is not null then
    if (v_touch.price - v_dir * v_half - s.stop_loss) * v_dir <= 0 then
      perform public.sim_close_trade(s.signal_id, s.stop_loss, v_touch.ts, 'sl');
    else
      perform public.sim_close_trade(s.signal_id, s.take_profit, v_touch.ts, 'tp');
    end if;
    return;
  end if;

  update public.sim_trade_plans set checked_at = v_now where signal_id = s.signal_id;
  if not public.sim_market_open(s.symbol, v_now) then return; end if;
  -- The last price recorded at or before this run's time (never one recorded later).
  select price into v_live from public.price_history
    where symbol = s.symbol and ts <= v_now and ts > v_now - interval '5 minutes' order by ts desc limit 1;
  if v_live is null then return; end if;
  v_live := round(v_live, v_dp) - v_dir * v_half;

  -- Holding time up, or a scalper / day trader going flat before gold / forex close.
  if v_now >= s.planned_close_at then
    perform public.sim_close_trade(s.signal_id, v_live, v_now, 'timeout');
  elsif v_kind <> 'crypto' and s.style in ('scalper', 'day') and not public.sim_market_open(s.symbol, v_now + interval '5 minutes') then
    perform public.sim_close_trade(s.signal_id, v_live, v_now, 'manual');
  end if;
exception when check_violation then
  raise warning 'sim_advance_trade: signal % rejected: %', p_signal_id, sqlerrm;
end $$;

update public.signals g
set closed_at = t.ts
from (
  select g2.id, (
    select min(ph.ts) from public.price_history ph
    where ph.symbol = g2.symbol and ph.ts > g2.closed_at and ph.ts <= g2.closed_at + interval '3 minutes'
      and round(ph.price, s.dp::int) - public.trade_dir(g2.side) * public.sim_half_spread(g2.symbol, g2.entry_price) = g2.exit_price) ts
  from public.signals g2
  join public.sim_history_builds b on b.provider_id = g2.provider_id
  join public.sim_symbols s on s.symbol = g2.symbol
  where g2.status = 'closed' and not g2.hidden and g2.closed_at > b.history_to
    and g2.exit_price not in (g2.stop_loss, g2.take_profit)
    and not exists (
      select 1 from public.price_history ph
      where ph.symbol = g2.symbol and ph.ts between g2.closed_at - interval '5 minutes' and g2.closed_at
        and round(ph.price, s.dp::int) - public.trade_dir(g2.side) * public.sim_half_spread(g2.symbol, g2.entry_price) = g2.exit_price)
) t
where t.id = g.id and t.ts is not null and (t.ts at time zone 'UTC')::date = (g.closed_at at time zone 'UTC')::date;

revoke truncate, trigger, references on public.provider_cards, public.provider_performance, public.provider_followers from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated;

commit;
