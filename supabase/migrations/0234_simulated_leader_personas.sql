-- Simulated leaders rebuilt around coherent personas.
--
-- * providers.is_simulated / providers.persona: every simulated leader trades
--   by one of 13 personas (scripts/sim/personas.mjs); its drawn values live in
--   providers.persona and drive both the rebuilt history and the live engine.
-- * Every stat is computed from the trades: signals.pnl_usd / return_pct are
--   set when a trade closes, provider_daily aggregates them per day (with
--   cash flows from provider_cash_flows), and provider_stats is refreshed
--   from provider_daily + signals. provider_cards reads only those.
-- * Simulated leaders are visible and copyable on demo accounts only; the
--   real account, visitors and public pages see real leaders only.
-- * run_market_simulation is the live engine: same rules as
--   scripts/sim/engine.mjs, on live prices.

begin;

-- ------------------------------------------------------------------ schema

alter table public.providers add column if not exists is_simulated boolean not null default false;
alter table public.providers add column if not exists persona jsonb;
update public.providers set is_simulated = (user_id is null) where is_simulated is distinct from (user_id is null);

alter table public.signals add column if not exists pnl_usd numeric;
alter table public.signals add column if not exists return_pct numeric;

-- Private plan of a simulated leader's open trade (never exposed to clients).
create table if not exists public.sim_trade_plans (
  signal_id uuid primary key references public.signals(id) on delete cascade,
  plan_win boolean not null,
  loss_hindsight boolean not null default false,
  hold_min integer not null,
  take_frac numeric not null,
  risk_pct numeric not null,
  equity_at_open numeric not null,
  planned_close_at timestamptz not null,
  next_check_at timestamptz not null,
  checked_at timestamptz not null default now()
);

create table if not exists public.provider_cash_flows (
  id bigserial primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  at timestamptz not null,
  amount numeric not null,
  kind text not null check (kind in ('deposit', 'withdrawal'))
);
create index if not exists provider_cash_flows_provider_idx on public.provider_cash_flows (provider_id, at);

-- One row per leader per UTC day. equity = start_equity + cash_flow + pnl;
-- the day's return is pnl / (start_equity + cash_flow).
create table if not exists public.provider_daily (
  provider_id uuid not null references public.providers(id) on delete cascade,
  day date not null,
  trades integer not null default 0,
  wins integer not null default 0,
  pnl numeric not null default 0,
  gross_profit numeric not null default 0,
  gross_loss numeric not null default 0,
  win_ret_sum numeric not null default 0,
  loss_ret_sum numeric not null default 0,
  cash_flow numeric not null default 0,
  start_equity numeric not null default 0,
  followers integer,
  aum numeric,
  primary key (provider_id, day)
);

create table if not exists public.provider_stats (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  dirty boolean not null default true,
  updated_at timestamptz,
  roi_7d numeric, roi_30d numeric, roi_90d numeric, roi_180d numeric, roi_all numeric,
  pnl_7d numeric, pnl_30d numeric, pnl_90d numeric, pnl_180d numeric, pnl_all numeric,
  trades_7d integer, trades_30d integer, trades_90d integer, trades_180d integer, trades_all integer,
  win_rate_7d numeric, win_rate_30d numeric, win_rate_90d numeric, win_rate_180d numeric, win_rate_all numeric,
  mdd_7d numeric, mdd_30d numeric, mdd_90d numeric, mdd_180d numeric, mdd_all numeric,
  sharpe_7d numeric, sharpe_30d numeric, sharpe_90d numeric, sharpe_180d numeric, sharpe_all numeric,
  avg_daily_return_pct numeric,
  avg_trade_return numeric,
  avg_win_pct numeric,
  avg_loss_pct numeric,
  profit_factor numeric,
  vol_daily_pct numeric,
  positive_months integer,
  months_counted integer,
  active_days integer,
  track_days integer,
  first_day date,
  twr_log_all numeric,
  total_withdrawals numeric,
  total_deposits numeric,
  followers integer,
  aum numeric,
  avg_hold_hours numeric,
  trades_per_week numeric,
  limit_pct numeric,
  asset_mix jsonb,
  primary_symbol text,
  primary_asset text,
  style text,
  risk_level text,
  rating_score numeric,
  tier text
);
create index if not exists provider_stats_dirty_idx on public.provider_stats (provider_id) where dirty;

create table if not exists public.sim_symbols (
  symbol text primary key,
  pip numeric not null,
  val numeric not null,
  step numeric not null,
  dp integer not null,
  kind text not null,
  comm numeric not null default 0,
  swap numeric not null default 0,
  fee numeric not null default 0,
  sigma_h numeric not null default 0.004
);
insert into public.sim_symbols (symbol, pip, val, step, dp, kind, comm, swap, fee) values
  ('XAUUSD', 0.1, 10, 0.01, 2, 'metal', 7, -3, 0),
  ('EURUSD', 0.0001, 10, 0.01, 5, 'fx', 7, -0.8, 0),
  ('GBPUSD', 0.0001, 10, 0.01, 5, 'fx', 7, -1, 0),
  ('USDJPY', 0.01, 9, 0.01, 3, 'fxjpy', 7, -0.8, 0),
  ('BTCUSDT', 1, 1, 0.001, 2, 'crypto', 0, 0, 0.0002),
  ('ETHUSDT', 0.1, 1, 0.001, 2, 'crypto', 0, 0, 0.0002),
  ('SOLUSDT', 0.01, 1, 0.001, 3, 'crypto', 0, 0, 0.0002),
  ('BNBUSDT', 0.1, 1, 0.001, 2, 'crypto', 0, 0, 0.0002),
  ('XRPUSDT', 0.0001, 1, 0.001, 4, 'crypto', 0, 0, 0.0002)
on conflict (symbol) do update set pip = excluded.pip, val = excluded.val, step = excluded.step, dp = excluded.dp,
  kind = excluded.kind, comm = excluded.comm, swap = excluded.swap, fee = excluded.fee;

alter table public.sim_trade_plans enable row level security;
alter table public.provider_cash_flows enable row level security;
alter table public.provider_daily enable row level security;
alter table public.provider_stats enable row level security;
alter table public.sim_symbols enable row level security;

-- ------------------------------------------------------------------ visibility

-- Demo accounts, admins and the service role see simulated leaders; real
-- accounts and visitors only see real ones.
create or replace function public.viewer_sees_simulated()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.role() = 'service_role', false)
      or exists (select 1 from public.profiles where id = auth.uid() and (account_type = 'demo' or is_admin));
$$;

drop policy if exists providers_select on public.providers;
create policy providers_select on public.providers for select to authenticated
  using (not is_simulated or user_id = auth.uid() or (select public.viewer_sees_simulated()));

drop policy if exists signals_select on public.signals;
create policy signals_select on public.signals for select to authenticated
  using (
    (not hidden and ((select public.viewer_sees_simulated())
                     or provider_id in (select id from public.providers where not is_simulated)))
    -- Hidden (retired) trades stay visible to whoever copied them.
    or (hidden and exists (select 1 from public.simulated_positions sp where sp.signal_id = signals.id and sp.follower_id = auth.uid()))
  );
drop policy if exists signals_select_public on public.signals;
create policy signals_select_public on public.signals for select to anon
  using (not hidden and provider_id in (select id from public.providers where not is_simulated));

drop policy if exists trader_posts_select_public on public.trader_posts;
create policy trader_posts_select_public on public.trader_posts for select to anon, authenticated
  using (provider_id in (select id from public.providers where not is_simulated) or (select public.viewer_sees_simulated()));

-- Following (bookmarking) a simulated leader is a demo-account feature too.
create or replace function public.follows_check_visibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.providers where id = new.provider_id and is_simulated)
     and not exists (select 1 from public.profiles where id = new.follower_id and account_type = 'demo') then
    raise exception 'leader_demo_only' using errcode = 'CM050';
  end if;
  return new;
end $$;
drop trigger if exists trg_follows_check_visibility on public.follows;
create trigger trg_follows_check_visibility before insert on public.follows
  for each row execute function public.follows_check_visibility();

-- The unused landing RPC read simulated leaders without any account check.
drop function if exists public.landing_top_traders(integer, integer, text[], integer, numeric);

-- ------------------------------------------------------------------ trade results

create or replace function public.trade_profit_contribution(s public.signals)
returns numeric language sql immutable as $$
  select case
    when s.status = 'closed' and not s.hidden and not s.created_by_admin and s.exit_price is not null
      then coalesce(s.pnl_usd, public.trade_profit_usd(s.symbol, s.side, s.entry_price, s.exit_price, s.lot_size), 0)
    else 0 end
$$;

-- A closed trade's net result (gross - commission + swap) and its return on
-- the leader's equity, when the closer didn't set them.
create or replace function public.signals_fill_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and new.exit_price is not null and new.pnl_usd is null then
    new.pnl_usd := round(coalesce(public.trade_profit_usd(new.symbol, new.side, new.entry_price, new.exit_price, new.lot_size), 0)
                   - coalesce(new.commission, 0) + coalesce(new.swap, 0), 2);
  end if;
  if new.status = 'closed' and new.pnl_usd is not null and new.return_pct is null then
    select case when account_capital > 0 then round(new.pnl_usd / account_capital * 100, 4) end
      into new.return_pct from public.providers where id = new.provider_id;
  end if;
  if new.status = 'open' then
    new.pnl_usd := null;
    new.return_pct := null;
  end if;
  return new;
end $$;
drop trigger if exists signals_fill_result on public.signals;
create trigger signals_fill_result before insert or update on public.signals
  for each row execute function public.signals_fill_result();

create or replace function public.provider_daily_apply(
  p_provider uuid, p_day date, p_trades integer, p_wins integer, p_pnl numeric,
  p_gross_profit numeric, p_gross_loss numeric, p_win_ret numeric, p_loss_ret numeric, p_cash numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.provider_daily (provider_id, day, start_equity)
  values (p_provider, p_day, coalesce((
    select d.start_equity + d.cash_flow + d.pnl from public.provider_daily d
    where d.provider_id = p_provider and d.day < p_day order by d.day desc limit 1), 0))
  on conflict (provider_id, day) do nothing;

  update public.provider_daily
  set trades = trades + p_trades, wins = wins + p_wins, pnl = pnl + p_pnl,
      gross_profit = gross_profit + p_gross_profit, gross_loss = gross_loss + p_gross_loss,
      win_ret_sum = win_ret_sum + p_win_ret, loss_ret_sum = loss_ret_sum + p_loss_ret,
      cash_flow = cash_flow + p_cash
  where provider_id = p_provider and day = p_day;

  -- A result booked on an earlier day carries into every later day's start.
  if p_pnl + p_cash <> 0 then
    update public.provider_daily set start_equity = start_equity + p_pnl + p_cash
    where provider_id = p_provider and day > p_day;
  end if;
end $$;

create or replace function public.mark_provider_stats_dirty(p_provider uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.provider_stats (provider_id, dirty) values (p_provider, true)
  on conflict (provider_id) do update set dirty = true where not public.provider_stats.dirty;
$$;

-- Keeps provider_daily, providers.total_profit and providers.account_capital
-- equal to the leader's visible closed trades (replaces
-- signals_maintain_provider_profit).
create or replace function public.signals_apply_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old boolean := tg_op = 'UPDATE' and old.status = 'closed' and not old.hidden and not old.created_by_admin
                   and old.pnl_usd is not null and old.closed_at is not null;
  v_new boolean := new.status = 'closed' and not new.hidden and not new.created_by_admin
                   and new.pnl_usd is not null and new.closed_at is not null;
  v_delta numeric := 0;
begin
  if not v_old and not v_new then
    return null;
  end if;
  if v_old and v_new and old.pnl_usd = new.pnl_usd and old.closed_at = new.closed_at
     and old.return_pct is not distinct from new.return_pct then
    return null;
  end if;
  if v_old then
    perform public.provider_daily_apply(old.provider_id, (old.closed_at at time zone 'UTC')::date,
      -1, -(old.pnl_usd > 0)::int, -old.pnl_usd, -greatest(old.pnl_usd, 0), -greatest(-old.pnl_usd, 0),
      -(case when old.pnl_usd > 0 then coalesce(old.return_pct, 0) else 0 end),
      -(case when old.pnl_usd <= 0 then coalesce(old.return_pct, 0) else 0 end), 0);
    v_delta := v_delta - old.pnl_usd;
  end if;
  if v_new then
    perform public.provider_daily_apply(new.provider_id, (new.closed_at at time zone 'UTC')::date,
      1, (new.pnl_usd > 0)::int, new.pnl_usd, greatest(new.pnl_usd, 0), greatest(-new.pnl_usd, 0),
      case when new.pnl_usd > 0 then coalesce(new.return_pct, 0) else 0 end,
      case when new.pnl_usd <= 0 then coalesce(new.return_pct, 0) else 0 end, 0);
    v_delta := v_delta + new.pnl_usd;
  end if;
  if v_delta <> 0 then
    update public.providers
    set total_profit = coalesce(total_profit, 0) + v_delta,
        account_capital = coalesce(account_capital, 0) + v_delta
    where id = new.provider_id;
  end if;
  perform public.mark_provider_stats_dirty(new.provider_id);
  return null;
end $$;
drop trigger if exists signals_maintain_provider_profit on public.signals;
drop trigger if exists signals_apply_result on public.signals;
create trigger signals_apply_result after insert or update on public.signals
  for each row execute function public.signals_apply_result();

create or replace function public.provider_cash_flows_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.provider_daily_apply(new.provider_id, (new.at at time zone 'UTC')::date, 0, 0, 0, 0, 0, 0, 0, new.amount);
  update public.providers set account_capital = coalesce(account_capital, 0) + new.amount where id = new.provider_id;
  perform public.mark_provider_stats_dirty(new.provider_id);
  return null;
end $$;
drop trigger if exists provider_cash_flows_apply on public.provider_cash_flows;
create trigger provider_cash_flows_apply after insert on public.provider_cash_flows
  for each row execute function public.provider_cash_flows_apply();

-- ------------------------------------------------------------------ stats

-- Recomputes provider_stats from provider_daily (and, with p_full, from the
-- trades themselves for holding time, asset mix, style). p_ids null = all.
create or replace function public.refresh_provider_stats(p_ids uuid[] default null, p_full boolean default false)
returns void language plpgsql security definer set search_path = public as $$
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
      when st.rating_score >= 80 then 'نخبة'
      when st.rating_score >= 62 then 'محترف'
      when st.rating_score >= 42 then 'متوسط'
      else 'مبتدئ' end
  where p_ids is null or st.provider_id = any(p_ids);
end $$;

create or replace function public.refresh_dirty_provider_stats()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  select array_agg(provider_id) into v_ids from public.provider_stats where dirty;
  if v_ids is not null then
    perform public.refresh_provider_stats(v_ids, false);
  end if;
end $$;

-- ------------------------------------------------------------------ cards

drop view if exists public.provider_cards;
create view public.provider_cards as
select
  p.id as provider_id,
  p.bio,
  coalesce(pr.display_name, p.display_name) as display_name,
  coalesce(st.followers, 0) as followers_count,
  (select count(*) from public.signals s
    where s.provider_id = p.id and s.status = 'open' and not s.hidden and not s.created_by_admin) as open_signals,
  coalesce(st.trades_all, 0) as closed_signals,
  st.win_rate_all as win_rate_pct,
  st.avg_trade_return as avg_return_pct,
  p.created_at as joined_at,
  coalesce(st.pnl_all, 0) as total_profit,
  coalesce(st.total_withdrawals, 0) as total_withdrawals,
  p.min_copy_amount,
  coalesce(st.vol_daily_pct, 0) as return_volatility,
  st.risk_level,
  st.rating_score,
  st.tier,
  st.avg_daily_return_pct,
  p.country,
  p.account_capital,
  p.trading_status,
  p.margin_called_at,
  p.avatar_url,
  p.is_archived,
  p.symbol_bias,
  st.primary_symbol,
  p.profit_share_pct,
  p.is_simulated,
  st.roi_7d, st.roi_30d, st.roi_90d, st.roi_180d, st.roi_all,
  st.pnl_7d, st.pnl_30d, st.pnl_90d, st.pnl_180d, st.pnl_all,
  st.trades_7d, st.trades_30d, st.trades_90d, st.trades_180d, st.trades_all,
  st.win_rate_7d, st.win_rate_30d, st.win_rate_90d, st.win_rate_180d, st.win_rate_all,
  st.mdd_7d, st.mdd_30d, st.mdd_90d, st.mdd_180d, st.mdd_all,
  st.sharpe_7d, st.sharpe_30d, st.sharpe_90d, st.sharpe_180d, st.sharpe_all,
  st.avg_win_pct, st.avg_loss_pct, st.profit_factor,
  st.positive_months, st.months_counted, st.active_days, st.track_days, st.first_day,
  st.total_deposits, st.aum, st.avg_hold_hours, st.trades_per_week, st.limit_pct,
  st.asset_mix, st.primary_asset, st.style
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_stats st on st.provider_id = p.id
where not p.is_simulated or (select public.viewer_sees_simulated());

grant select on public.provider_cards to anon, authenticated;

-- Daily equity series of one leader for the profile charts (one row, so no
-- API row cap applies).
create or replace function public.provider_daily_series(p_provider_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (
      select 1 from public.providers p
      where p.id = p_provider_id and (not p.is_simulated or public.viewer_sees_simulated() or p.user_id = auth.uid()))
    then null
    else (
      select jsonb_build_object(
        'days', coalesce(jsonb_agg(d.day order by d.day), '[]'::jsonb),
        'ret', coalesce(jsonb_agg(round(case when d.start_equity + d.cash_flow > 0 then d.pnl / (d.start_equity + d.cash_flow) else 0 end, 6) order by d.day), '[]'::jsonb),
        'trades', coalesce(jsonb_agg(d.trades order by d.day), '[]'::jsonb),
        'wins', coalesce(jsonb_agg(d.wins order by d.day), '[]'::jsonb),
        'pnl', coalesce(jsonb_agg(round(d.pnl, 2) order by d.day), '[]'::jsonb),
        'equity', coalesce(jsonb_agg(round(d.start_equity + d.cash_flow + d.pnl, 2) order by d.day), '[]'::jsonb))
      from public.provider_daily d where d.provider_id = p_provider_id)
    end
$$;
grant execute on function public.provider_daily_series(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ copy rules

-- Copying a simulated leader is a demo-account feature: blocked server-side
-- for any other account.
create or replace function public.copy_check_leader_account(p_provider_id uuid, p_follower uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.providers where id = p_provider_id and is_simulated)
     and not exists (select 1 from public.profiles where id = p_follower and account_type = 'demo') then
    raise exception 'leader_demo_only' using errcode = 'CM050';
  end if;
end $$;

-- ------------------------------------------------------------------ engine helpers

create or replace function public.sim_market_open(p_symbol text, p_at timestamptz)
returns boolean language sql immutable as $$
  select case
    when p_symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT') then true
    else not (
      extract(dow from p_at at time zone 'UTC') = 6
      or (extract(dow from p_at at time zone 'UTC') = 0 and extract(hour from p_at at time zone 'UTC') < 22)
      or (extract(dow from p_at at time zone 'UTC') = 5 and extract(hour from p_at at time zone 'UTC') >= 22)
      or to_char(p_at at time zone 'UTC', 'MM-DD') in ('01-01', '12-25'))
  end
$$;

-- Target log-return of the persona's time-weighted equity index d days after
-- joining. Mirrors targetLog() in scripts/sim/personas.mjs.
create or replace function public.sim_target_log(t jsonb, d numeric)
returns numeric language plpgsql immutable as $$
declare
  k text := t ->> 'kind';
  raw numeric := 0;
  dips numeric := 0;
  amp numeric := (t ->> 'amp')::numeric;
  sh jsonb;
  sday numeric;
  ssize numeric;
  x numeric;
  last_day numeric;
  every numeric;
  v numeric;
begin
  if k in ('linear', 'choppy') then
    raw := (t ->> 'a')::numeric * d / 365;
  elsif k = 'boom_bust' then
    if d < (t ->> 'p')::numeric then
      raw := (t ->> 'a1')::numeric * d / 365;
    elsif d < (t ->> 'p')::numeric + (t ->> 'b')::numeric then
      raw := (t ->> 'a1')::numeric * (t ->> 'p')::numeric / 365 + (t ->> 'drop')::numeric * (d - (t ->> 'p')::numeric) / (t ->> 'b')::numeric;
    else
      raw := (t ->> 'a1')::numeric * (t ->> 'p')::numeric / 365 + (t ->> 'drop')::numeric
             + (t ->> 'a3')::numeric * (d - (t ->> 'p')::numeric - (t ->> 'b')::numeric) / 365;
    end if;
  elsif k = 'recovery' then
    if d < (t ->> 'q')::numeric then
      raw := (t ->> 'a1')::numeric * d / 365;
    else
      raw := (t ->> 'a1')::numeric * (t ->> 'q')::numeric / 365 + (t ->> 'a2')::numeric * (d - (t ->> 'q')::numeric) / 365;
    end if;
  elsif k = 'crash' then
    raw := (t ->> 'a')::numeric * d / 365;
    last_day := 0;
    for sh in select * from jsonb_array_elements(t -> 'shocks') loop
      sday := (sh ->> 0)::numeric;
      ssize := (sh ->> 1)::numeric;
      last_day := sday;
      if sday < d then
        x := d - sday;
        raw := raw + 0.4 * ssize * least(1, greatest(0, x / 5));
        dips := dips + 0.6 * ssize * least(1, x / 5) * (1 - least(1, greatest(0, (x - 5) / 45)));
      end if;
    end loop;
    every := (t ->> 'every')::numeric;
    sday := last_day + every;
    while every > 0 and sday < d loop
      x := d - sday;
      ssize := (t ->> 'extra')::numeric;
      raw := raw + 0.4 * ssize * least(1, greatest(0, x / 5));
      dips := dips + 0.6 * ssize * least(1, x / 5) * (1 - least(1, greatest(0, (x - 5) / 45)));
      sday := sday + every;
    end loop;
  end if;
  v := greatest(raw, coalesce((t ->> 'floor')::numeric, -1e9)) + dips;
  if amp is not null then
    v := v + amp * sin(2 * pi() * d / (t ->> 'period')::numeric + (t ->> 'phase')::numeric) - amp * sin((t ->> 'phase')::numeric);
  end if;
  return v;
end $$;

-- Gross USD result in the same pip convention as trade_profit_usd.
create or replace function public.sim_units(p_symbol text)
returns numeric language sql stable as $$
  select val / pip from public.sim_symbols where symbol = p_symbol
$$;

create or replace function public.sim_notional(p_symbol text, p_lot numeric, p_price numeric)
returns numeric language sql stable as $$
  select case s.kind when 'fx' then p_lot * 100000 * p_price
                     when 'fxjpy' then p_lot * 100000
                     else p_lot * (s.val / s.pip) * p_price end
  from public.sim_symbols s where s.symbol = p_symbol
$$;

-- Closes a simulated trade at a price that traded at p_closed_at, with its
-- commission, overnight swap, net result and return on equity at open.
create or replace function public.sim_close_trade(p_signal_id uuid, p_exit numeric, p_closed_at timestamptz, p_trigger text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
  sym record;
  v_exit numeric;
  v_closed timestamptz;
  v_commission numeric;
  v_swap numeric := 0;
  v_nights int := 0;
  v_roll timestamptz;
  v_gross numeric;
  v_pnl numeric;
  v_eq numeric;
begin
  select g.*, pl.equity_at_open into s
  from public.signals g join public.sim_trade_plans pl on pl.signal_id = g.id
  where g.id = p_signal_id and g.status = 'open' for update of g;
  if not found then return; end if;
  select * into sym from public.sim_symbols where symbol = s.symbol;

  v_exit := round(p_exit, sym.dp);
  v_closed := greatest(least(p_closed_at, now()), s.opened_at + interval '1 second');
  if sym.kind = 'crypto' then
    v_commission := round(sym.fee * (public.sim_notional(s.symbol, s.lot_size, s.entry_price)
                                     + public.sim_notional(s.symbol, s.lot_size, v_exit)) / 2, 2);
  else
    v_commission := round(sym.comm * s.lot_size, 2);
    v_roll := date_trunc('day', s.opened_at at time zone 'UTC') at time zone 'UTC' + interval '22 hours';
    if v_roll <= s.opened_at then v_roll := v_roll + interval '1 day'; end if;
    while v_roll < v_closed loop
      if public.sim_market_open(s.symbol, v_roll - interval '1 hour') then v_nights := v_nights + 1; end if;
      v_roll := v_roll + interval '1 day';
    end loop;
    v_swap := round(sym.swap * s.lot_size * v_nights, 2);
  end if;
  v_gross := round((v_exit - s.entry_price) * public.trade_dir(s.side) * (sym.val / sym.pip) * s.lot_size, 2);
  v_pnl := round(v_gross - v_commission + v_swap, 2);
  v_eq := nullif(s.equity_at_open, 0);

  update public.signals
  set status = 'closed', exit_price = v_exit, closed_at = v_closed, close_trigger = p_trigger,
      commission = v_commission, swap = v_swap, pnl_usd = v_pnl,
      return_pct = round(v_pnl / v_eq * 100, 4)
  where id = p_signal_id;
  delete from public.sim_trade_plans where signal_id = p_signal_id;
end $$;

-- Session weight of the persona at an hour (0 = not trading then).
create or replace function public.sim_session_weight(p jsonb, p_hour int)
returns numeric language sql immutable as $$
  select coalesce(max((x ->> 2)::numeric) filter (where p_hour >= (x ->> 0)::int and p_hour < (x ->> 1)::int), 0)
  from jsonb_array_elements(p -> 'sessions') x
$$;

create or replace function public.sim_session_minutes(p jsonb)
returns numeric language sql immutable as $$
  select sum(((x ->> 1)::numeric - (x ->> 0)::numeric) * 60 * (x ->> 2)::numeric)
  from jsonb_array_elements(p -> 'sessions') x
$$;

-- Tries to open one trade for a simulated leader (the caller has already
-- drawn that a trade is due). Mirrors simulateLeader/planTrade/retroEntry.
create or replace function public.sim_open_trade(p_provider_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
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
end $$;

-- Advances one open simulated trade to now. Mirrors resolveTrade/windowExit.
create or replace function public.sim_advance_trade(p_signal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
end $$;

-- ------------------------------------------------------------------ live engine

create or replace function public.run_market_simulation()
returns void language plpgsql security definer set search_path = public as $$
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
           (select count(*) from public.signals s where s.provider_id = p.id and s.status = 'open') as open_n
    from public.providers p
    where p.is_simulated and p.persona is not null and not p.is_archived and coalesce(p.trading_status, 'active') = 'active'
  loop
    v_w := public.sim_session_weight(r.persona, v_hour);
    continue when v_w = 0;
    continue when v_weekend and not coalesce((r.persona ->> 'weekend')::boolean, false);
    continue when r.open_n >= coalesce((r.persona ->> 'max_open')::int, 1);
    continue when random() >= (r.persona ->> 'tpd')::numeric / public.sim_session_minutes(r.persona) * v_w;
    perform public.sim_open_trade(r.id);
  end loop;

  perform public.refresh_dirty_provider_stats();
end $$;

-- Rolling 30-day hourly volatility per symbol, from the live price history.
create or replace function public.refresh_sim_symbol_volatility()
returns void language sql security definer set search_path = public as $$
  update public.sim_symbols s set sigma_h = v.sd
  from (
    select symbol, stddev_samp(r) sd from (
      select symbol, ln(price / lag(price) over (partition by symbol order by h)) r
      from (
        select symbol, date_trunc('hour', ts) h, (array_agg(price order by ts desc))[1] price
        from public.price_history where ts > now() - interval '30 days'
        group by 1, 2
      ) hourly
    ) x where r is not null and r <> 0 group by symbol having count(*) > 48
  ) v where v.symbol = s.symbol;
$$;
select public.refresh_sim_symbol_volatility();

-- Nightly: today's daily rows, month-start cash flows, followers / AUM,
-- symbol volatility and a full stats refresh. Replaces the old lifecycle
-- (which spawned new leaders and archived margin-called ones).
create or replace function public.run_daily_leader_maintenance()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  r record;
  v_month_pnl numeric;
  v_amount numeric;
  v_roi90 numeric;
  v_log numeric;
  v_peak numeric;
  v_target numeric;
  v_prev numeric;
  v_f numeric;
begin
  perform public.refresh_sim_symbol_volatility();

  -- Every leader gets today's row (carrying its equity forward).
  insert into public.provider_daily (provider_id, day, start_equity)
  select p.id, v_today, coalesce((
    select d.start_equity + d.cash_flow + d.pnl from public.provider_daily d
    where d.provider_id = p.id and d.day < v_today order by d.day desc limit 1), 0)
  from public.providers p
  on conflict (provider_id, day) do nothing;

  for r in select p.id, p.persona, p.account_capital, p.is_simulated from public.providers p loop
    if r.is_simulated and r.persona is not null then
      -- Month start: part of last month's profit is withdrawn; a wiped-out
      -- account gets topped up.
      if extract(day from v_today) = 1 then
        select coalesce(sum(pnl), 0) into v_month_pnl from public.provider_daily
          where provider_id = r.id and day >= (v_today - interval '1 month')::date and day < v_today;
        if v_month_pnl > 0 and random() < (r.persona ->> 'wd_prob')::numeric
           and r.account_capital - v_month_pnl * (r.persona ->> 'wd_frac')::numeric > (r.persona ->> 'cap0')::numeric * 0.8 then
          v_amount := round(v_month_pnl * (r.persona ->> 'wd_frac')::numeric / 10) * 10;
          if v_amount > 0 then
            insert into public.provider_cash_flows (provider_id, at, amount, kind)
            values (r.id, now() + make_interval(mins => floor(random() * 600)::int), -v_amount, 'withdrawal');
          end if;
        end if;
        if r.account_capital < (r.persona ->> 'cap0')::numeric * 0.3
           and random() < (case when r.persona ->> 'key' = 'gambler' then 0.9 else 0.7 end) then
          v_amount := round(((r.persona ->> 'cap0')::numeric * (0.5 + random() * 0.5) - r.account_capital) / 10) * 10;
          if v_amount > 0 then
            insert into public.provider_cash_flows (provider_id, at, amount, kind)
            values (r.id, now() + make_interval(mins => floor(random() * 600)::int), v_amount, 'deposit');
          end if;
        end if;
      end if;
      if r.account_capital < (r.persona ->> 'cap0')::numeric * 0.12
         and not exists (select 1 from public.signals where provider_id = r.id and status = 'open') then
        v_amount := round(((r.persona ->> 'cap0')::numeric * (0.4 + random() * 0.4) - r.account_capital) / 10) * 10;
        if v_amount > 0 then
          insert into public.provider_cash_flows (provider_id, at, amount, kind) values (r.id, now(), v_amount, 'deposit');
        end if;
      end if;

      -- Followers follow the last 90 days' return, the drawdown and the
      -- track length (scripts/sim/engine.mjs followerSeries).
      select exp(coalesce(sum(ln(greatest(1e-9, 1 + x.r))) filter (where x.day > v_today - 90), 0)) - 1,
             coalesce(sum(ln(greatest(1e-9, 1 + x.r))), 0)
        into v_roi90, v_log
        from (select day, case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end r
              from public.provider_daily where provider_id = r.id) x;
      select max(l) into v_peak from (
        select sum(ln(greatest(1e-9, 1 + case when start_equity + cash_flow > 0 then pnl / (start_equity + cash_flow) else 0 end)))
               over (order by day) l
        from public.provider_daily where provider_id = r.id) y;
      v_peak := greatest(coalesce(v_peak, 0), 0);
      v_target := (r.persona ->> 'pop')::numeric
        * exp(2.2 * least(1.2, greatest(-0.6, v_roi90)))
        * power(1 - least(0.9, greatest(0, 1 - exp(v_log - v_peak))), 1.5)
        * power(least(1, ((v_today - (select min(day) from public.provider_daily where provider_id = r.id)) + 15) / 240.0), 0.7);
      select followers into v_prev from public.provider_daily
        where provider_id = r.id and day < v_today and followers is not null order by day desc limit 1;
      v_prev := coalesce(v_prev, 0);
      v_f := greatest(0, v_prev + 0.05 * (v_target - v_prev)
                         + sqrt(-2 * ln(greatest(random(), 1e-12))) * cos(2 * pi() * random()) * sqrt(v_prev + 1) * 0.3);
      update public.provider_daily
      set followers = round(v_f),
          aum = round(round(v_f) * (r.persona ->> 'copy_avg')::numeric
                      * (1 + 0.1 * sin((v_today - (select min(day) from public.provider_daily where provider_id = r.id)) / 37.0
                                       + (r.persona ->> 'seed')::bigint % 7)))
      where provider_id = r.id and day = v_today;
    else
      update public.provider_daily
      set followers = (select count(*) from public.subscriptions s where s.provider_id = r.id and s.is_active),
          aum = public.provider_aum(r.id)
      where provider_id = r.id and day = v_today;
    end if;
  end loop;

  perform public.refresh_provider_stats(null, true);
end $$;

-- ------------------------------------------------------------------ live forex feed

-- EURUSD now comes from Binance's EURUSDT book (intraday); GBP and JPY stay on
-- the daily reference rates.
create or replace function public.fire_price_fetch_requests()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_crypto_request_id bigint;
  v_forex_request_id bigint;
begin
  select net.http_get(
    url := 'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22%2C%22ETHUSDT%22%2C%22SOLUSDT%22%2C%22BNBUSDT%22%2C%22XRPUSDT%22%2C%22PAXGUSDT%22%2C%22EURUSDT%22%5D'
  ) into v_crypto_request_id;

  select net.http_get(
    url := 'https://api.frankfurter.app/latest?from=USD&to=GBP,JPY'
  ) into v_forex_request_id;

  insert into public._price_fetch_state (source, request_id) values ('crypto', v_crypto_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
  insert into public._price_fetch_state (source, request_id) values ('forex', v_forex_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
end;
$$;

create or replace function public.apply_price_fetch_responses()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_crypto_request_id bigint;
  v_forex_request_id bigint;
  v_crypto_body jsonb;
  v_forex_body jsonb;
  v_item jsonb;
  v_binance_symbol text;
  v_price numeric;
  v_out_symbol text;
  v_gbp numeric;
  v_jpy numeric;
  v_forex_date date;
  v_now timestamptz := now();
begin
  select request_id into v_crypto_request_id from public._price_fetch_state where source = 'crypto';
  select request_id into v_forex_request_id from public._price_fetch_state where source = 'forex';

  if v_crypto_request_id is not null then
    begin
      select content::jsonb into v_crypto_body
      from net._http_response
      where id = v_crypto_request_id and status_code = 200;

      if v_crypto_body is not null then
        for v_item in select * from jsonb_array_elements(v_crypto_body)
        loop
          v_binance_symbol := v_item ->> 'symbol';
          v_price := (v_item ->> 'price')::numeric;
          v_out_symbol := case v_binance_symbol when 'PAXGUSDT' then 'XAUUSD' when 'EURUSDT' then 'EURUSD' else v_binance_symbol end;

          insert into public.market_prices (symbol, price, updated_at, source_date)
          values (v_out_symbol, v_price, v_now, null)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = null;

          insert into public.price_history (symbol, ts, price)
          values (v_out_symbol, v_now, v_price)
          on conflict (symbol, ts) do nothing;
        end loop;
      end if;
    exception when others then
      null;
    end;
  end if;

  if v_forex_request_id is not null then
    begin
      select content::jsonb -> 'rates', nullif(content::jsonb ->> 'date', '')::date into v_forex_body, v_forex_date
      from net._http_response
      where id = v_forex_request_id and status_code = 200;

      if v_forex_body is not null then
        v_gbp := (v_forex_body ->> 'GBP')::numeric;
        v_jpy := (v_forex_body ->> 'JPY')::numeric;

        if v_gbp is not null and v_gbp > 0 then
          insert into public.market_prices (symbol, price, updated_at, source_date) values ('GBPUSD', 1 / v_gbp, v_now, v_forex_date)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = coalesce(excluded.source_date, public.market_prices.source_date);
          insert into public.price_history (symbol, ts, price) values ('GBPUSD', v_now, 1 / v_gbp)
          on conflict (symbol, ts) do nothing;
        end if;
        if v_jpy is not null then
          insert into public.market_prices (symbol, price, updated_at, source_date) values ('USDJPY', v_jpy, v_now, v_forex_date)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = coalesce(excluded.source_date, public.market_prices.source_date);
          insert into public.price_history (symbol, ts, price) values ('USDJPY', v_now, v_jpy)
          on conflict (symbol, ts) do nothing;
        end if;
      end if;
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- ------------------------------------------------------------------ schedules

-- The engine is paused (unscheduled) here; scripts/sim/rebuild.mjs loads the
-- rebuilt history and then schedules it again together with the nightly job.
select cron.unschedule(jobid) from cron.job
where command in ('select public.run_market_simulation();', 'select public.run_daily_leader_lifecycle()',
                  'select public.refresh_provider_performance();');
drop function if exists public.run_daily_leader_lifecycle();

commit;
