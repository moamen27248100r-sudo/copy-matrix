-- Leader track records without look-ahead, and every leader number from the trades.
-- Rollback: supabase/rollback/0246_causal_leader_engine.sql
--
--  1. Logged-out visitors saw a simulated leader's stats and curve (provider_cards /
--     provider_daily_series follow viewer_sees_simulated()) but none of the trades
--     (signals_select_public only allowed real leaders), so the history read "no closed
--     trades". The anon policy now follows the same rule.
--  2. Live engine (sim_open_trade / sim_advance_trade), same rules as the history rebuild
--     (scripts/sim/engine.mjs):
--       - a trade opens NOW at the live price plus half the spread; no backdated "retro"
--         entry at a better recent price, no planned winners;
--       - direction from the move over the persona's lookback (trend / reversion, with
--         probability `follow`), otherwise a coin flip;
--       - it closes only when the live price (exit side of the spread) touches the stop or
--         the target -- at that level -- or at the market once the holding time is up;
--         scalpers / day traders go flat 5 minutes before gold / forex close; no exit at
--         the best price of a past window;
--       - drawdown brake: half risk past the profile's lower drawdown bound, a quarter near
--         the upper bound and no new trade until 7 days after the last close.
--  3. sim_symbols carries each symbol's spread; sim_trade_plans no longer needs the
--     planned-outcome columns.
--  4. sim_history_builds records which leaders the rebuild script has written (it skips
--     them on a rerun).
--  5. Stats: active_days counts the UTC days with a trade opened or closed (from the
--     trades, not the ledger); the average holding time covers every closed trade; a
--     closed trade refreshes all of its leader's stats (asset mix, holding time, limit
--     share, style included), not only the ledger-based ones.
--  6. provider_trade_days: per-day trade totals for the profile history (exact totals of
--     any period while only the latest trades are listed).

begin;

-- 1. Anonymous visitors see the trades of the leaders they can see -----------------------------
drop policy if exists signals_select_public on public.signals;
create policy signals_select_public on public.signals for select to anon
  using (not hidden and ((select public.viewer_sees_simulated())
                         or provider_id = any (coalesce((select public.real_provider_ids()), '{}'::uuid[]))));

-- 3. Spreads and plans -------------------------------------------------------------------------
alter table public.sim_symbols add column if not exists spread numeric, add column if not exists spread_rel numeric;
update public.sim_symbols set
  spread = case symbol when 'XAUUSD' then 0.15 when 'EURUSD' then 0.00002 when 'GBPUSD' then 0.00003 when 'USDJPY' then 0.003 end,
  spread_rel = case when kind = 'crypto' then 0.00002 end;

alter table public.sim_trade_plans alter column plan_win drop not null, alter column take_frac drop not null;

-- 4. Rebuild bookkeeping -----------------------------------------------------------------------
create table if not exists public.sim_history_builds (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  version int not null,
  candidate int not null,
  score numeric,
  trades int not null,
  open_trades int not null,
  history_from timestamptz not null,
  history_to timestamptz not null,
  built_at timestamptz not null default now()
);
alter table public.sim_history_builds enable row level security;
revoke all on public.sim_history_builds from anon, authenticated;

-- 2. Live engine -------------------------------------------------------------------------------

-- Half the spread at a price, rounded to the symbol's decimals (at least one tick).
create or replace function public.sim_half_spread(p_symbol text, p_price numeric)
returns numeric language sql stable set search_path to 'public' as $$
  select greatest(power(10::numeric, -s.dp), round(coalesce(s.spread, p_price * s.spread_rel) / 2, s.dp::int))
  from public.sim_symbols s where s.symbol = p_symbol
$$;

-- Risk multiplier from the drawdown of the time-weighted equity index (today's realised
-- result included): 1, 0.5 past the lower bound, 0.25 near the upper bound, 0 (no new
-- trade) while the last close is under 7 days old there. engine.mjs drawdownBrake.
create or replace function public.sim_drawdown_brake(p_provider_id uuid, p_persona jsonb, p_day_ret numeric)
returns numeric language plpgsql stable set search_path to 'public' as $$
declare
  v_log numeric;
  v_peak numeric;
  v_cur numeric;
  v_dd numeric;
  v_last timestamptz;
begin
  with x as (
    select day, ln(greatest(1e-9, 1 + case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end)) l
    from public.provider_daily where provider_id = p_provider_id and day < (now() at time zone 'UTC')::date
  )
  select coalesce(sum(l), 0), greatest(0, coalesce(max(cl), 0)) into v_log, v_peak
  from (select l, sum(l) over (order by day) cl from x) c;
  v_cur := v_log + ln(greatest(1e-9, 1 + p_day_ret));
  v_dd := 1 - exp(v_cur - greatest(v_peak, v_cur));
  if v_dd >= (p_persona -> 'dd' ->> 1)::numeric * 0.9 then
    select max(closed_at) into v_last from public.signals
      where provider_id = p_provider_id and status = 'closed' and not hidden and not created_by_admin;
    return case when v_last is not null and now() - v_last < interval '7 days' then 0 else 0.25 end;
  end if;
  return case when v_dd > (p_persona -> 'dd' ->> 0)::numeric then 0.5 else 1 end;
end $$;

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
  where s.provider_id = p_provider_id and s.status = 'open';
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
  select price into v_live from public.market_prices
    where symbol = v_symbol and updated_at > v_now - interval '5 minutes';
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
  select price into v_live from public.market_prices where symbol = s.symbol and updated_at > v_now - interval '5 minutes';
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

-- 5. Stats ------------------------------------------------------------------------------------
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
  ), act as (
    -- Active trading days: UTC days with a public trade opened or closed.
    select x.provider_id, count(distinct x.d) n
    from (
      select s.provider_id, (s.opened_at at time zone 'UTC')::date d
      from public.signals s join ids on ids.id = s.provider_id where not s.hidden and not s.created_by_admin
      union all
      select s.provider_id, (s.closed_at at time zone 'UTC')::date
      from public.signals s join ids on ids.id = s.provider_id
      where not s.hidden and not s.created_by_admin and s.status = 'closed' and s.closed_at is not null
    ) x group by x.provider_id
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
    active_days = coalesce(act.n, 0),
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
  left join act on act.provider_id = p.id
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
    ), alltime as (
      select provider_id, avg(hours) hold_h, count(*) n,
             count(*) filter (where close_trigger in ('tp', 'sl')) limits,
             count(*) filter (where closed_at > now() - interval '90 days') n90
      from t group by provider_id
    ), mix as (
      select provider_id, jsonb_object_agg(symbol, n) mix,
             (array_agg(symbol order by n desc, symbol))[1] top_symbol
      from (select provider_id, symbol, count(*) n from t group by 1, 2) x group by provider_id
    ), cls as (
      select provider_id,
             (array_agg(cls order by n desc, cls))[1] top_class
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
      avg_hold_hours = round(alltime.hold_h::numeric, 2),
      trades_per_week = round(coalesce(alltime.n90, 0) * 7.0 / greatest(1, least(90, st.track_days)), 2),
      limit_pct = case when alltime.n > 0 then round(100.0 * alltime.limits / alltime.n, 1) end,
      asset_mix = mix.mix,
      primary_symbol = mix.top_symbol,
      primary_asset = cls.top_class,
      style = case
        when alltime.hold_h is null then null
        when alltime.hold_h < 0.5 then 'scalper'
        when alltime.hold_h < 24 then 'day'
        when alltime.hold_h < 288 then 'swing'
        else 'position' end
    from ids
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

-- A closed trade refreshes every stat of its leader.
create or replace function public.refresh_dirty_provider_stats()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_ids uuid[];
begin
  select array_agg(provider_id) into v_ids from public.provider_stats where dirty;
  if v_ids is not null then
    perform public.refresh_provider_stats(v_ids, true);
  end if;
end $$;

-- 6. The trade history's totals: every public closed trade of a leader per UTC day and
-- symbol, [day, symbol, trades, pnl, swap, commission] with money in cents, so the profile
-- can total any period / symbol exactly while listing only the latest trades. Same
-- visibility as provider_daily_series.
create or replace function public.provider_trade_days(p_provider_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when not exists (
      select 1 from public.providers p
      where p.id = p_provider_id and (not p.is_simulated or public.viewer_sees_simulated() or p.user_id = auth.uid()))
    then null
    else coalesce((
      select jsonb_agg(jsonb_build_array(x.d, x.symbol, x.n, x.pnl, x.swap, x.comm) order by x.d, x.symbol)
      from (
        select (s.closed_at at time zone 'UTC')::date d, s.symbol, count(*) n,
               round(sum(coalesce(s.pnl_usd, 0)) * 100)::bigint pnl,
               round(sum(coalesce(s.swap, 0)) * 100)::bigint swap,
               round(sum(coalesce(s.commission, 0)) * 100)::bigint comm
        from public.signals s
        where s.provider_id = p_provider_id and s.status = 'closed' and not s.hidden and not s.created_by_admin
          and s.closed_at is not null
        group by 1, 2) x), '[]'::jsonb)
    end
$$;
grant execute on function public.provider_trade_days(uuid) to anon, authenticated;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('sim_half_spread', 'sim_drawdown_brake')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
