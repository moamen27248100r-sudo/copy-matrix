-- Read-only helper for the public landing page: per-trader 12-month stats
-- computed from real closed public signals (created_by_admin = false).
-- A copier's mirrored position is sized from their fixed allocated amount
-- (0193/0194, it does not grow with profit), so returns ADD UP rather than
-- compound:
--   ret    = sum of each trade's signed % move over the window
--   dd     = max peak-to-trough fall of that cumulative curve (capped at 100)
--   series = cumulative % at the end of each month (chart)
-- Only active (not archived, not stopped) providers with at least p_min_trades
-- closed trades in the window qualify; p_max_return drops outliers whose
-- 12-month return is implausibly large (data-quality guard). p_countries
-- optionally restricts the pool (Arabic-named traders on the Arabic site).
-- Returns ONE jsonb: id lists for three tabs + a per-trader map. No writes.
DROP FUNCTION IF EXISTS public.landing_top_traders(integer, integer, text[], integer);
CREATE OR REPLACE FUNCTION public.landing_top_traders(
  p_days integer DEFAULT 365,
  p_min_trades integer DEFAULT 30,
  p_countries text[] DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_max_return numeric DEFAULT 150)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  with t as (
    select s.provider_id, s.id, s.closed_at,
           greatest(
             case when s.side = 'sell' then -(s.exit_price - s.entry_price) / s.entry_price
                  else (s.exit_price - s.entry_price) / s.entry_price end,
             -0.999999)::double precision as r
    from public.signals s
    join public.providers pr on pr.id = s.provider_id
    where s.status = 'closed'
      and s.created_by_admin = false
      and s.exit_price is not null
      and s.entry_price > 0
      and s.closed_at is not null
      and s.closed_at >= now() - make_interval(days => p_days)
      and pr.is_archived = false
      and coalesce(pr.trading_status, '') <> 'stopped'
      and (p_countries is null or pr.country = any(p_countries))
  ), e as (
    select t.*, sum(r) over (partition by provider_id order by closed_at, id) as lg
    from t
  ), p as (
    select e.*, greatest(0::double precision, max(lg) over (partition by provider_id order by closed_at, id
             rows between unbounded preceding and current row)) as pk,
           date_trunc('month', closed_at) as m
    from e
  ), agg as (
    select provider_id, count(*) as n,
           sum(r) as ret,
           least(1, max(pk - lg)) as dd
    from p group by provider_id having count(*) >= p_min_trades and sum(r) * 100 <= p_max_return
  ), monthly as (
    select provider_id, m, (array_agg(lg order by closed_at desc, id desc))[1] as lgm
    from p group by provider_id, m
  ), ser as (
    select provider_id, jsonb_agg(round((lgm * 100)::numeric, 2) order by m) as series
    from monthly group by provider_id
  ), x as (
    select a.provider_id, a.n, a.ret, a.dd, s.series,
           pc.display_name, pc.country, pc.followers_count, pc.primary_symbol, pc.min_copy_amount
    from agg a
    join ser s using (provider_id)
    join public.provider_cards pc on pc.provider_id = a.provider_id
  ), f as (select provider_id from x order by followers_count desc limit p_limit),
     rk as (select provider_id from x where ret > 0 order by dd asc, ret desc limit p_limit),
     rt as (select provider_id from x order by ret desc limit p_limit),
     pick as (select provider_id from f union select provider_id from rk union select provider_id from rt)
  select jsonb_build_object(
    'followers', (select coalesce(jsonb_agg(f.provider_id), '[]'::jsonb) from (select f2.provider_id from f f2 join x using (provider_id) order by x.followers_count desc) f),
    'risk',      (select coalesce(jsonb_agg(r.provider_id), '[]'::jsonb) from (select r2.provider_id from rk r2 join x using (provider_id) order by x.dd asc, x.ret desc) r),
    'return',    (select coalesce(jsonb_agg(u.provider_id), '[]'::jsonb) from (select u2.provider_id from rt u2 join x using (provider_id) order by x.ret desc) u),
    'traders',   (select coalesce(jsonb_object_agg(x.provider_id, jsonb_build_object(
                    'name', x.display_name, 'country', x.country, 'followers', x.followers_count,
                    'symbol', x.primary_symbol, 'trades', x.n,
                    'ret', round((x.ret * 100)::numeric, 1), 'dd', round((x.dd * 100)::numeric, 1),
                    'series', x.series, 'minCopy', x.min_copy_amount)), '{}'::jsonb)
                  from x join pick using (provider_id))
  );
$$;
GRANT EXECUTE ON FUNCTION public.landing_top_traders(integer, integer, text[], integer, numeric) TO anon, authenticated;
