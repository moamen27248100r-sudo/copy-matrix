-- Reverts 0246: the previous live engine, stats refresh and anon trade policy.
-- The rebuilt trade histories are data and stay (restore a backup to undo them).
begin;
drop policy if exists signals_select_public on public.signals;
create policy signals_select_public on public.signals for select to anon
  using (not hidden and provider_id = any (coalesce((select public.real_provider_ids()), '{}'::uuid[])));

CREATE OR REPLACE FUNCTION public.sim_advance_trade(p_signal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  v_now timestamptz := now();
  v_dir int;
  v_tp_dist numeric;
  v_sl_dist numeric;
  v_touch record;
  v_live numeric;
  v_grace timestamptz;
  v_window int;
  v_best record;
  v_late boolean;
  v_step interval;
begin
  select g.id, g.symbol, g.side, g.entry_price, g.stop_loss, g.take_profit, g.opened_at, pl.*
    into s from public.signals g join public.sim_trade_plans pl on pl.signal_id = g.id
    where g.id = p_signal_id and g.status = 'open';
  if not found then return; end if;
  v_dir := public.trade_dir(s.side);
  v_tp_dist := (s.take_profit - s.entry_price) * v_dir;
  v_sl_dist := (s.entry_price - s.stop_loss) * v_dir;

  -- A level touched since the last check closes the trade at that level.
  select ts, price into v_touch from public.price_history
  where symbol = s.symbol and ts > greatest(s.checked_at, s.opened_at) and ts <= v_now
    and ((price - s.entry_price) * v_dir >= v_tp_dist or (price - s.entry_price) * v_dir <= -v_sl_dist)
    and public.sim_market_open(s.symbol, ts)
  order by ts limit 1;
  if v_touch.ts is not null then
    if (v_touch.price - s.entry_price) * v_dir >= v_tp_dist then
      perform public.sim_close_trade(s.signal_id, s.take_profit, v_touch.ts, 'tp');
    else
      perform public.sim_close_trade(s.signal_id, s.stop_loss, v_touch.ts, 'sl');
    end if;
    return;
  end if;

  update public.sim_trade_plans set checked_at = v_now where signal_id = s.signal_id;
  if v_now < s.next_check_at or not public.sim_market_open(s.symbol, v_now) then return; end if;

  select price into v_live from public.market_prices where symbol = s.symbol;
  v_grace := s.opened_at + make_interval(mins => s.hold_min * (case when s.plan_win then 3 else 2 end));

  if not s.plan_win and not s.loss_hindsight then
    if v_now >= v_grace then
      perform public.sim_close_trade(s.signal_id, v_live, v_now, 'timeout');
    else
      update public.sim_trade_plans set next_check_at = v_grace where signal_id = s.signal_id;
    end if;
    return;
  end if;

  v_late := v_now >= s.opened_at + make_interval(mins => round(s.hold_min * 1.5)::int);
  v_window := least(1440, greatest(1, s.hold_min));
  if s.plan_win then
    select ts, price, (price - s.entry_price) * v_dir e into v_best from public.price_history
    where symbol = s.symbol and ts >= greatest(s.opened_at + interval '1 minute', v_now - make_interval(mins => v_window)) and ts <= v_now
      and public.sim_market_open(s.symbol, ts)
    order by (price - s.entry_price) * v_dir desc, ts limit 1;
    if v_best.ts is not null and v_best.e > 0 and v_best.e >= (case when v_late then 0 else s.take_frac end) * v_tp_dist then
      perform public.sim_close_trade(s.signal_id, v_best.price, v_best.ts, 'manual');
      return;
    end if;
  else
    select ts, price, (price - s.entry_price) * v_dir e into v_best from public.price_history
    where symbol = s.symbol and ts >= greatest(s.opened_at + interval '1 minute', v_now - make_interval(mins => v_window)) and ts <= v_now
      and public.sim_market_open(s.symbol, ts)
    order by (price - s.entry_price) * v_dir asc, ts limit 1;
    if v_best.ts is not null and v_best.e <= -0.15 * v_sl_dist then
      perform public.sim_close_trade(s.signal_id, v_best.price, v_best.ts, 'manual');
      return;
    end if;
  end if;

  if v_now >= v_grace then
    perform public.sim_close_trade(s.signal_id, v_live, v_now, 'timeout');
  else
    v_step := case when s.hold_min < 120 then interval '1 minute' else interval '15 minutes' end;
    update public.sim_trade_plans set next_check_at = v_now + v_step where signal_id = s.signal_id;
  end if;
exception when check_violation then
  raise warning 'sim_advance_trade: signal % rejected: %', p_signal_id, sqlerrm;
end $function$;

CREATE OR REPLACE FUNCTION public.sim_open_trade(p_provider_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_symbol text;
  v_roll numeric;
  v_acc numeric;
  a record;
  sym record;
  v_live numeric;
  v_cur_log numeric;
  v_gap numeric;
  v_pwin numeric;
  v_plan_win boolean;
  v_hold int;
  v_entry numeric;
  v_sl_dist numeric;
  v_tp_dist numeric;
  v_dir int;
  v_risk_usd numeric;
  v_lot numeric;
  v_max_lot numeric;
  v_units numeric;
  v_opened timestamptz;
  v_retro_max int;
  v_d int;
  v_lo record;
  v_hi record;
  v_use_low boolean;
  v_new_entry numeric;
  v_new_dir int;
  v_from timestamptz;
  v_id uuid;
begin
  select * into pr from public.providers where id = p_provider_id;
  p := pr.persona;
  if p is null or coalesce(pr.account_capital, 0) <= 0 then return false; end if;

  lim_day := case p ->> 'risk' when 'low' then 0.03 when 'medium' then 0.07 else 0.18 end;
  select n_lo, n_hi, x_lo, x_hi into lim_nlo, lim_nhi, lim_xlo, lim_xhi from (values
    ('low', -0.06, 0.06, -0.10, 0.10), ('medium', -0.12, 0.15, -0.20, 0.25), ('high', -0.30, 0.40, -0.45, 0.60)
  ) v(k, n_lo, n_hi, x_lo, x_hi) where k = p ->> 'risk';

  -- Daily / monthly brakes.
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
  where s.provider_id = p_provider_id and s.status = 'open';
  if v_exposure + (p ->> 'risk_pct')::numeric * v_rr
     > lim_day * 100 * (case p ->> 'style' when 'swing' then 1.25 when 'position' then 1.2 else 0.85 end) then
    return false;
  end if;

  -- Symbol by the persona's weights (daily-only pairs for multi-day styles).
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
  select price into v_live from public.market_prices
    where symbol = v_symbol and updated_at > v_now - interval '5 minutes';
  if v_live is null or v_live <= 0 then return false; end if;

  -- Regulator: distance between the trajectory and the equity index.
  select coalesce(sum(ln(greatest(1e-9, 1 + case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end))), 0)
    into v_cur_log from public.provider_daily where provider_id = p_provider_id;
  v_gap := public.sim_target_log(p -> 'traj', extract(epoch from (v_now - (p ->> 'start')::timestamptz)) / 86400) - v_cur_log;
  v_pwin := least(0.97, greatest(0.03, (p ->> 'wr')::numeric + 4 * v_gap));
  v_plan_win := random() < v_pwin;

  v_hold := greatest(1, round(exp(ln((p -> 'hold' ->> 0)::numeric) + random() * (ln((p -> 'hold' ->> 1)::numeric) - ln((p -> 'hold' ->> 0)::numeric)))))::int;
  v_entry := round(v_live, sym.dp);
  v_sl_dist := v_entry * sym.sigma_h * sqrt(greatest(v_hold, 5) / 60.0) * (p ->> 'k_sl')::numeric * (0.8 + random() * 0.45);
  v_sl_dist := greatest(v_sl_dist, sym.pip * (case when sym.kind = 'crypto' then 5 else 8 end), v_entry * 0.0004);
  v_tp_dist := v_sl_dist * (p ->> 'rr')::numeric * (0.85 + random() * 0.33);
  v_dir := case when random() < 0.5 then 1 else -1 end;
  v_units := sym.val / sym.pip;
  v_risk_usd := pr.account_capital * (p ->> 'risk_pct')::numeric / 100 * (0.85 + random() * 0.3);
  v_lot := floor(v_risk_usd / (v_sl_dist * v_units) / sym.step) * sym.step;
  v_max_lot := floor(pr.account_capital * (p ->> 'lev')::numeric / public.sim_notional(v_symbol, 1, v_entry) / sym.step) * sym.step;
  v_lot := least(v_lot, v_max_lot);
  if v_lot < sym.step then
    if sym.step * v_sl_dist * v_units > v_risk_usd * 3 then return false; end if;
    v_lot := sym.step;
  end if;
  v_opened := v_now;

  -- Retro entry: the best (planned win) / worst (planned loss) recent price.
  if random() < least(0.9, greatest(0, case when v_plan_win then 0.5 + 3 * v_gap else -3 * v_gap end)) then
    v_retro_max := case p ->> 'style' when 'swing' then 360 when 'position' then 1440 else 60 end;
    v_d := least(v_retro_max, greatest(1, round(v_hold * 0.3)));
    select ts, price into v_lo from public.price_history
      where symbol = v_symbol and ts >= v_now - make_interval(mins => v_d) and ts < v_now and public.sim_market_open(v_symbol, ts)
      order by price asc, ts desc limit 1;
    select ts, price into v_hi from public.price_history
      where symbol = v_symbol and ts >= v_now - make_interval(mins => v_d) and ts < v_now and public.sim_market_open(v_symbol, ts)
      order by price desc, ts desc limit 1;
    if v_lo.ts is not null and v_hi.ts is not null then
      if v_plan_win then
        v_use_low := (v_live - v_lo.price) >= (v_hi.price - v_live);
        v_new_dir := case when v_use_low then 1 else -1 end;
      else
        v_use_low := (v_live - v_lo.price) < (v_hi.price - v_live);
        v_new_dir := case when v_use_low then -1 else 1 end;
      end if;
      v_from := case when v_use_low then v_lo.ts else v_hi.ts end;
      v_new_entry := round(case when v_use_low then v_lo.price else v_hi.price end, sym.dp);
      if not exists (
        select 1 from public.price_history
        where symbol = v_symbol and ts >= v_from and ts <= v_now
          and ((price - v_new_entry) * v_new_dir >= v_tp_dist or (price - v_new_entry) * v_new_dir <= -v_sl_dist)
      ) then
        v_hold := v_hold + round(extract(epoch from (v_now - v_from)) / 60)::int;
        v_entry := v_new_entry;
        v_dir := v_new_dir;
        v_opened := v_from;
      end if;
    end if;
  end if;

  insert into public.signals (provider_id, symbol, side, entry_price, stop_loss, take_profit, lot_size, status, opened_at)
  values (p_provider_id, v_symbol, case when v_dir > 0 then 'buy' else 'sell' end, v_entry,
          round(v_entry - v_dir * v_sl_dist, sym.dp), round(v_entry + v_dir * v_tp_dist, sym.dp),
          round(v_lot, 3), 'open', v_opened)
  returning id into v_id;

  insert into public.sim_trade_plans (signal_id, plan_win, loss_hindsight, hold_min, take_frac, risk_pct, equity_at_open,
                                      planned_close_at, next_check_at, checked_at)
  values (v_id, v_plan_win, v_gap < 0, v_hold,
          least(0.9, greatest(0.4, 0.25 + 0.3 * (p ->> 'rr')::numeric)),
          round(v_lot * v_sl_dist * v_units * 100 / pr.account_capital, 4), pr.account_capital,
          v_opened + make_interval(mins => v_hold), v_opened + make_interval(mins => v_hold), v_now);
  return true;
exception when check_violation then
  raise warning 'sim_open_trade: provider % rejected: %', p_provider_id, sqlerrm;
  return false;
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_provider_stats(p_ids uuid[] DEFAULT NULL::uuid[], p_full boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.provider_stats (provider_id)
  select p.id from public.providers p
  where (p_ids is null or p.id = any(p_ids))
  on conflict (provider_id) do nothing;

  with ids as (
    select p.id from public.providers p where p_ids is null or p.id = any(p_ids)
  ), d as (
    select pd.provider_id, pd.day, pd.trades, pd.wins, pd.pnl,
           case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end as r,
           (current_date - pd.day) as age
    from public.provider_daily pd join ids on ids.id = pd.provider_id
  ), pd as (
    select d.*, w.period from d cross join unnest(array[7, 30, 90, 180, 100000]) w(period) where d.age < w.period
  ), cum as (
    select pd.*, sum(ln(greatest(1e-9, 1 + r))) over (partition by provider_id, period order by day) as l
    from pd
  ), pk as (
    select cum.*, greatest(0, max(l) over (partition by provider_id, period order by day
                                           rows between unbounded preceding and current row)) as peak
    from cum
  ), agg as (
    select provider_id, period,
           exp(sum(ln(greatest(1e-9, 1 + r)))) - 1 as roi,
           sum(pnl) as pnl, sum(trades)::int as trades, sum(wins)::int as wins,
           max(1 - exp(l - peak)) as mdd,
           case when count(*) > 2 and stddev_samp(r) > 0 then avg(r) / stddev_samp(r) * sqrt(365) end as sharpe
    from pk group by provider_id, period
  ), piv as (
    select provider_id,
      max(roi) filter (where period = 7) roi_7d, max(roi) filter (where period = 30) roi_30d,
      max(roi) filter (where period = 90) roi_90d, max(roi) filter (where period = 180) roi_180d,
      max(roi) filter (where period = 100000) roi_all,
      max(pnl) filter (where period = 7) pnl_7d, max(pnl) filter (where period = 30) pnl_30d,
      max(pnl) filter (where period = 90) pnl_90d, max(pnl) filter (where period = 180) pnl_180d,
      max(pnl) filter (where period = 100000) pnl_all,
      max(trades) filter (where period = 7) trades_7d, max(trades) filter (where period = 30) trades_30d,
      max(trades) filter (where period = 90) trades_90d, max(trades) filter (where period = 180) trades_180d,
      max(trades) filter (where period = 100000) trades_all,
      max(case when trades > 0 then 100.0 * wins / trades end) filter (where period = 7) win_rate_7d,
      max(case when trades > 0 then 100.0 * wins / trades end) filter (where period = 30) win_rate_30d,
      max(case when trades > 0 then 100.0 * wins / trades end) filter (where period = 90) win_rate_90d,
      max(case when trades > 0 then 100.0 * wins / trades end) filter (where period = 180) win_rate_180d,
      max(case when trades > 0 then 100.0 * wins / trades end) filter (where period = 100000) win_rate_all,
      max(mdd) filter (where period = 7) mdd_7d, max(mdd) filter (where period = 30) mdd_30d,
      max(mdd) filter (where period = 90) mdd_90d, max(mdd) filter (where period = 180) mdd_180d,
      max(mdd) filter (where period = 100000) mdd_all,
      max(sharpe) filter (where period = 7) sharpe_7d, max(sharpe) filter (where period = 30) sharpe_30d,
      max(sharpe) filter (where period = 90) sharpe_90d, max(sharpe) filter (where period = 180) sharpe_180d,
      max(sharpe) filter (where period = 100000) sharpe_all
    from agg group by provider_id
  ), allt as (
    select pd.provider_id,
      sum(pd.gross_profit) gp, sum(pd.gross_loss) gl, sum(pd.wins) wins, sum(pd.trades) trades,
      sum(pd.win_ret_sum) wrs, sum(pd.loss_ret_sum) lrs,
      count(*) filter (where pd.trades > 0) active_days,
      min(pd.day) first_day,
      sum(ln(greatest(1e-9, 1 + case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end))) twr_log,
      avg(case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end)
        filter (where pd.day > current_date - 30) avg_r30,
      stddev_samp(case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end)
        filter (where pd.day > current_date - 180) sd_r180,
      (array_agg(pd.followers order by pd.day desc) filter (where pd.followers is not null))[1] last_followers,
      (array_agg(pd.aum order by pd.day desc) filter (where pd.aum is not null))[1] last_aum
    from public.provider_daily pd join ids on ids.id = pd.provider_id
    group by pd.provider_id
  ), months as (
    select m.provider_id, count(*) filter (where m.ret > 0) positive, count(*) counted
    from (
      select pd.provider_id, date_trunc('month', pd.day) mo,
             exp(sum(ln(greatest(1e-9, 1 + case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end)))) - 1 ret
      from public.provider_daily pd join ids on ids.id = pd.provider_id
      where pd.day >= date_trunc('month', current_date) - interval '12 months'
        and pd.day < date_trunc('month', current_date)
      group by 1, 2
    ) m group by m.provider_id
  ), cf as (
    select c.provider_id,
           -coalesce(sum(c.amount) filter (where c.kind = 'withdrawal'), 0) withdrawals,
           coalesce(sum(c.amount) filter (where c.kind = 'deposit'), 0) deposits
    from public.provider_cash_flows c join ids on ids.id = c.provider_id group by c.provider_id
  ), subs as (
    select s.provider_id, count(*) n
    from public.subscriptions s join ids on ids.id = s.provider_id
    where s.is_active group by s.provider_id
  )
  update public.provider_stats st set
    dirty = false,
    updated_at = now(),
    roi_7d = round(100 * coalesce(piv.roi_7d, 0), 2), roi_30d = round(100 * coalesce(piv.roi_30d, 0), 2),
    roi_90d = round(100 * coalesce(piv.roi_90d, 0), 2), roi_180d = round(100 * coalesce(piv.roi_180d, 0), 2),
    roi_all = round(100 * coalesce(piv.roi_all, 0), 2),
    pnl_7d = round(coalesce(piv.pnl_7d, 0), 2), pnl_30d = round(coalesce(piv.pnl_30d, 0), 2),
    pnl_90d = round(coalesce(piv.pnl_90d, 0), 2), pnl_180d = round(coalesce(piv.pnl_180d, 0), 2),
    pnl_all = round(coalesce(piv.pnl_all, 0), 2),
    trades_7d = coalesce(piv.trades_7d, 0), trades_30d = coalesce(piv.trades_30d, 0),
    trades_90d = coalesce(piv.trades_90d, 0), trades_180d = coalesce(piv.trades_180d, 0),
    trades_all = coalesce(piv.trades_all, 0),
    win_rate_7d = round(piv.win_rate_7d, 1), win_rate_30d = round(piv.win_rate_30d, 1),
    win_rate_90d = round(piv.win_rate_90d, 1), win_rate_180d = round(piv.win_rate_180d, 1),
    win_rate_all = round(piv.win_rate_all, 1),
    mdd_7d = round(100 * coalesce(piv.mdd_7d, 0), 2), mdd_30d = round(100 * coalesce(piv.mdd_30d, 0), 2),
    mdd_90d = round(100 * coalesce(piv.mdd_90d, 0), 2), mdd_180d = round(100 * coalesce(piv.mdd_180d, 0), 2),
    mdd_all = round(100 * coalesce(piv.mdd_all, 0), 2),
    sharpe_7d = round(piv.sharpe_7d::numeric, 2), sharpe_30d = round(piv.sharpe_30d::numeric, 2),
    sharpe_90d = round(piv.sharpe_90d::numeric, 2), sharpe_180d = round(piv.sharpe_180d::numeric, 2),
    sharpe_all = round(piv.sharpe_all::numeric, 2),
    avg_daily_return_pct = round(100 * coalesce(allt.avg_r30, 0), 3),
    avg_trade_return = case when allt.trades > 0 then round((allt.wrs + allt.lrs) / allt.trades, 3) end,
    avg_win_pct = case when allt.wins > 0 then round(allt.wrs / allt.wins, 3) end,
    avg_loss_pct = case when allt.trades - allt.wins > 0 then round(-allt.lrs / (allt.trades - allt.wins), 3) end,
    profit_factor = case when allt.gl > 0 then round(allt.gp / allt.gl, 2) end,
    vol_daily_pct = round(100 * coalesce(allt.sd_r180, 0), 3),
    positive_months = coalesce(months.positive, 0),
    months_counted = coalesce(months.counted, 0),
    active_days = coalesce(allt.active_days, 0),
    first_day = allt.first_day,
    track_days = coalesce(current_date - allt.first_day, 0),
    twr_log_all = coalesce(allt.twr_log, 0),
    total_withdrawals = round(coalesce(cf.withdrawals, 0), 2),
    total_deposits = round(coalesce(cf.deposits, 0), 2),
    followers = coalesce(allt.last_followers, 0) * (case when p.is_simulated then 1 else 0 end) + coalesce(subs.n, 0),
    aum = round(coalesce(allt.last_aum, 0) * (case when p.is_simulated then 1 else 0 end) + public.provider_aum(p.id), 2)
  from public.providers p
  left join piv on piv.provider_id = p.id
  left join allt on allt.provider_id = p.id
  left join months on months.provider_id = p.id
  left join cf on cf.provider_id = p.id
  left join subs on subs.provider_id = p.id
  where st.provider_id = p.id and (p_ids is null or p.id = any(p_ids));

  if p_full then
    with ids as (
      select p.id from public.providers p where p_ids is null or p.id = any(p_ids)
    ), t as (
      select s.provider_id, s.symbol, s.close_trigger,
             extract(epoch from (s.closed_at - s.opened_at)) / 3600.0 as hours,
             s.closed_at
      from public.signals s join ids on ids.id = s.provider_id
      where s.status = 'closed' and not s.hidden and not s.created_by_admin and s.closed_at is not null
    ), recent as (
      select provider_id, avg(hours) hold_h, count(*) n
      from t where closed_at > now() - interval '180 days' group by provider_id
    ), alltime as (
      select provider_id, avg(hours) hold_h, count(*) n,
             count(*) filter (where close_trigger in ('tp', 'sl')) limits,
             count(*) filter (where closed_at > now() - interval '90 days') n90
      from t group by provider_id
    ), mix as (
      select provider_id, jsonb_object_agg(symbol, n) mix,
             (array_agg(symbol order by n desc))[1] top_symbol
      from (select provider_id, symbol, count(*) n from t group by 1, 2) x group by provider_id
    ), cls as (
      select provider_id,
             (array_agg(cls order by n desc))[1] top_class
      from (
        select provider_id,
               case when symbol in ('XAUUSD') then 'gold'
                    when symbol in ('EURUSD', 'GBPUSD', 'USDJPY') then 'forex'
                    else 'crypto' end cls,
               count(*) n
        from t
        group by 1, 2
      ) y group by provider_id
    )
    update public.provider_stats st set
      avg_hold_hours = round(coalesce(recent.hold_h, alltime.hold_h)::numeric, 2),
      trades_per_week = round(coalesce(alltime.n90, 0) * 7.0 / greatest(1, least(90, st.track_days)), 2),
      limit_pct = case when alltime.n > 0 then round(100.0 * alltime.limits / alltime.n, 1) end,
      asset_mix = mix.mix,
      primary_symbol = mix.top_symbol,
      primary_asset = cls.top_class,
      style = case
        when coalesce(recent.hold_h, alltime.hold_h) is null then null
        when coalesce(recent.hold_h, alltime.hold_h) < 0.5 then 'scalper'
        when coalesce(recent.hold_h, alltime.hold_h) < 24 then 'day'
        when coalesce(recent.hold_h, alltime.hold_h) < 288 then 'swing'
        else 'position' end
    from ids
    left join recent on recent.provider_id = ids.id
    left join alltime on alltime.provider_id = ids.id
    left join mix on mix.provider_id = ids.id
    left join cls on cls.provider_id = ids.id
    where st.provider_id = ids.id;
  end if;

  -- Risk level from the equity curve (drawdown and daily volatility, fixed
  -- thresholds), rating from return, drawdown, consistency, track length
  -- and win rate.
  update public.provider_stats st set
    risk_level = case
      when st.trades_all = 0 then null
      when st.mdd_all >= 30 or st.vol_daily_pct * sqrt(365) >= 40 then 'مرتفعة'
      when st.mdd_all < 15 and st.vol_daily_pct * sqrt(365) < 15 then 'منخفضة'
      else 'متوسطة' end,
    rating_score = case when st.trades_all = 0 then null else round(100 * (
        0.32 * least(1, greatest(0, (st.roi_180d + 20) / 60.0))
      + 0.25 * least(1, greatest(0, 1 - st.mdd_all / 50.0))
      + 0.18 * (case when st.months_counted > 0 then st.positive_months::numeric / st.months_counted else 0.5 end)
      + 0.15 * least(1, st.track_days / 540.0)
      + 0.10 * least(1, greatest(0, (coalesce(st.win_rate_all, 0) - 35) / 35.0)))) end
  where p_ids is null or st.provider_id = any(p_ids);

  update public.provider_stats st set
    tier = case
      when st.rating_score is null then null
      when st.rating_score >= 75 then 'نخبة'
      when st.rating_score >= 62 then 'محترف'
      when st.rating_score >= 42 then 'متوسط'
      else 'مبتدئ' end
  where p_ids is null or st.provider_id = any(p_ids);
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_dirty_provider_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids uuid[];
begin
  select array_agg(provider_id) into v_ids from public.provider_stats where dirty;
  if v_ids is not null then
    perform public.refresh_provider_stats(v_ids, false);
  end if;
end $function$;

drop function if exists public.sim_drawdown_brake(uuid, jsonb, numeric);
drop function if exists public.sim_half_spread(text, numeric);
drop function if exists public.provider_trade_days(uuid);
commit;
