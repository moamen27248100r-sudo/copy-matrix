-- 0269: the risk level counts the drawdown too
--
-- Level from volatility (0265, unchanged): realized volatility under 15% low, 15% to 40% medium, 40%
-- and up high. Level from drawdown: the leader's largest fall from a peak, under 15% low, 15% to 30%
-- medium, 30% and up high. The risk level is the HIGHER of the two.
-- The drawdown used is the larger of
--   * provider_stats.mdd_all (closed trades, whole record, written by refresh_provider_stats), and
--   * provider_stats.mdd_floating_all: the same with the floating losses of open trades
--     (leader_adjusted_drawdown, whole record) -- the figure the profile shows. It is heavy, so a job
--     refreshes it every 10 minutes, oldest first, skipping leaders whose level is already high
--     from the closed-trade drawdown.
-- One function (leader_risk_level) decides the level; the stats refresh and the job both use it, and
-- every screen reads provider_stats.risk_level through provider_cards.
-- Rollback: supabase/rollback/0269_risk_level_drawdown.sql

begin;

alter table public.provider_stats add column if not exists mdd_floating_all numeric;
alter table public.provider_stats add column if not exists mdd_floating_at timestamptz;

drop function if exists public.leader_risk_level(numeric);
create or replace function public.leader_risk_level(p_realized_vol_pct numeric, p_mdd_pct numeric)
returns text language sql immutable as $$
  select case
    when p_realized_vol_pct is null and p_mdd_pct is null then null
    when coalesce(p_realized_vol_pct, 0) >= 40 or coalesce(p_mdd_pct, 0) >= 30 then 'مرتفعة'
    when coalesce(p_realized_vol_pct, 0) >= 15 or coalesce(p_mdd_pct, 0) >= 15 then 'متوسطة'
    else 'منخفضة' end
$$;
grant execute on function public.leader_risk_level(numeric, numeric) to anon, authenticated;

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

  -- Risk level: the higher of the realized-volatility level and the drawdown level (leader_risk_level, 0269);
  -- rating from return, drawdown, consistency, track length and win rate.
  update public.provider_stats st set
    realized_vol_pct = public.leader_realized_vol(st.provider_id)
  where p_ids is null or st.provider_id = any(p_ids);

  update public.provider_stats st set
    risk_level = case when st.trades_all = 0 then null else public.leader_risk_level(st.realized_vol_pct, greatest(st.mdd_all, st.mdd_floating_all)) end,
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

-- The floating-loss drawdown, a batch at a time (the job), and the level of those leaders again.
create or replace function public.refresh_leader_floating_drawdown(p_limit integer default 120)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_batch uuid[];
  i integer := 1;
begin
  select array_agg(provider_id) into v_ids from (
    select st.provider_id from public.provider_stats st
    where st.trades_all > 0 and coalesce(st.mdd_all, 0) < 30
    order by st.mdd_floating_at nulls first
    limit p_limit
  ) x;
  if v_ids is null then return 0; end if;
  while i <= array_length(v_ids, 1) loop
    v_batch := v_ids[i:i + 59];
    update public.provider_stats st
    set mdd_floating_all = a.mdd, mdd_floating_at = now()
    from (
      select b.id, d.mdd from unnest(v_batch) b(id)
      left join public.leader_adjusted_drawdown(v_batch, 0) d on d.provider_id = b.id
    ) a
    where st.provider_id = a.id;
    i := i + 60;
  end loop;
  update public.provider_stats st
  set risk_level = case when st.trades_all = 0 then null else public.leader_risk_level(st.realized_vol_pct, greatest(st.mdd_all, st.mdd_floating_all)) end
  where st.provider_id = any(v_ids);
  return array_length(v_ids, 1);
end $$;
revoke all on function public.refresh_leader_floating_drawdown(integer) from public, anon, authenticated;

-- every stored level, now (the floating figure is filled by the job; the closed one is here already)
update public.provider_stats st
set risk_level = case when st.trades_all = 0 then null else public.leader_risk_level(st.realized_vol_pct, greatest(st.mdd_all, st.mdd_floating_all)) end;

select cron.schedule('refresh-leader-floating-drawdown', '*/10 * * * *', 'select public.refresh_leader_floating_drawdown(120)');

commit;
