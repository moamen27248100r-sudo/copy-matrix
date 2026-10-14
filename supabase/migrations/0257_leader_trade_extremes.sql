-- 0257: read-only maximum drawdown that includes floating losses
--
-- A leader's maximum drawdown used to be measured on closed trades only. This function returns,
-- for a list of leaders and a period, the drawdown of the leader's account value INCLUDING the
-- worst floating result each trade went through while it was open (from the stored price history,
-- which covers only the most recent days). The exact formula and its limits are written in
-- src/lib/leader-scores.ts (maxDrawdownWithFloating, with unit tests); this function is the same
-- algorithm over the database rows:
--
--   realized(t)     start equity + results of the trades closed strictly before t
--   peak(t)         highest realized value up to t
--   for each trade with price history:  floor = min(0, worst floating result, final result),
--       at its worst moment:  drawdown = (peak - (realized + floor)) / peak
--   plus the drop of the realized curve after every close.
--
-- It reads only. No trade, leader statistic or price is changed.
-- Rollback: supabase/rollback/0257_leader_trade_extremes.sql

begin;

create or replace function public.leader_adjusted_drawdown(p_provider_ids uuid[], p_days integer default null)
returns table (provider_id uuid, mdd numeric, trades_with_prices integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with since as (
    select case when p_days is null or p_days <= 0 then null::timestamptz else now() - make_interval(days => p_days) end as ts
  ),
  ids as (
    select distinct unnest(p_provider_ids[1:60]) as id
  ),
  tr as (
    select s.provider_id, s.symbol, s.side, s.entry_price, s.lot_size, s.opened_at, s.closed_at, s.pnl_usd
    from public.signals s
    join ids on ids.id = s.provider_id
    cross join since
    where not s.hidden and not s.created_by_admin
      and (since.ts is null or s.closed_at is null or s.closed_at >= since.ts)
  ),
  st as (
    select ids.id as provider_id,
           coalesce(
             (select pd.start_equity + pd.cash_flow
              from public.provider_daily pd, since
              where pd.provider_id = ids.id and (since.ts is null or pd.day >= (since.ts at time zone 'UTC')::date)
              order by pd.day limit 1),
             (select p.account_capital from public.providers p where p.id = ids.id)
           ) as equity
    from ids
  ),
  closed as (
    select tr.provider_id, tr.closed_at, tr.pnl_usd,
           st.equity + sum(coalesce(tr.pnl_usd, 0)) over (partition by tr.provider_id order by tr.closed_at rows unbounded preceding) as eq,
           st.equity as start_eq
    from tr join st on st.provider_id = tr.provider_id
    where tr.closed_at is not null and st.equity > 0
  ),
  peaks as (
    select c.*, greatest(c.start_eq, max(c.eq) over (partition by c.provider_id order by c.closed_at rows unbounded preceding)) as pk
    from closed c
  ),
  closed_dd as (
    select provider_id, max(case when pk > 0 then (pk - eq) / pk else 0 end) as dd from peaks group by provider_id
  ),
  pmin as (select min(ts) as ts from public.price_history),
  priced as (
    select t.provider_id, t.closed_at, t.pnl_usd, w.fl, w.ts as worst_at
    from tr t
    cross join pmin
    left join public.sim_symbols ss on ss.symbol = t.symbol
    join lateral (
      select ph.ts,
             ((ph.price - t.entry_price) * (case when t.side = 'sell' then -1 else 1 end) / nullif(ss.pip, 0)) * ss.val * coalesce(t.lot_size, 0) as fl
      from public.price_history ph
      where ph.symbol = t.symbol
        and ph.ts >= t.opened_at
        and ph.ts <= coalesce(t.closed_at, now())
      order by fl asc
      limit 1
    ) w on coalesce(t.closed_at, now()) >= pmin.ts
  ),
  floating as (
    select pr.provider_id,
           max(case when s.pk > 0 then (s.pk - (s.eq + least(0, pr.fl, coalesce(pr.pnl_usd, 0)))) / s.pk
                    when st.equity > 0 then (st.equity - (st.equity + least(0, pr.fl, coalesce(pr.pnl_usd, 0)))) / st.equity
                    else 0 end) as dd,
           count(*)::int as n
    from priced pr
    join st on st.provider_id = pr.provider_id and st.equity > 0
    left join lateral (
      select p.eq, p.pk from peaks p
      where p.provider_id = pr.provider_id and p.closed_at < pr.worst_at
      order by p.closed_at desc limit 1
    ) s on true
    where least(0, pr.fl, coalesce(pr.pnl_usd, 0)) < 0
    group by pr.provider_id
  )
  select ids.id,
         round(100 * greatest(coalesce(cd.dd, 0), coalesce(f.dd, 0)), 2) as mdd,
         coalesce(f.n, 0) as trades_with_prices
  from ids
  left join closed_dd cd on cd.provider_id = ids.id
  left join floating f on f.provider_id = ids.id;
$function$;

revoke all on function public.leader_adjusted_drawdown(uuid[], integer) from public, anon;
grant execute on function public.leader_adjusted_drawdown(uuid[], integer) to authenticated, anon, service_role;

commit;
