-- Bulk per-provider stats for the discover page's period / max-drawdown
-- filters. Doing this in the browser-side JS meant paging ~320k closed signals
-- through PostgREST (minutes); here it is one set-based scan.
-- Same conventions as the trader page: public signals only
-- (created_by_admin = false), per-trade signed return, drawdown compounded
-- against a running equity multiplier (so it can never exceed 100%).
-- Returns ONE jsonb object {provider_id: {trades,win_rate,total_return,max_drawdown}}
-- so PostgREST's 1000-row response cap does not apply (there are ~1400 providers).
DROP FUNCTION IF EXISTS public.provider_period_stats(integer);
CREATE FUNCTION public.provider_period_stats(p_days integer DEFAULT NULL)
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
    where s.status = 'closed'
      and s.created_by_admin = false
      and s.exit_price is not null
      and s.entry_price > 0
      and s.closed_at is not null
      and (p_days is null or s.closed_at >= now() - make_interval(days => p_days))
  ), e as (
    select t.*, sum(ln(1 + r)) over (partition by provider_id order by closed_at, id) as lg
    from t
  ), p as (
    select e.*, greatest(0, max(lg) over (partition by provider_id order by closed_at, id
                                          rows between unbounded preceding and current row)) as pk
    from e
  )
  select coalesce(jsonb_object_agg(g.provider_id, jsonb_build_object(
           'trades', g.trades, 'win_rate', g.win_rate,
           'total_return', g.total_return, 'max_drawdown', g.max_drawdown)), '{}'::jsonb)
  from (
    select p.provider_id,
           count(*)::integer as trades,
           round(100.0 * count(*) filter (where r > 0) / count(*), 0) as win_rate,
           round((100 * sum(r))::numeric, 2) as total_return,
           round((100 * max(1 - exp(lg - pk)))::numeric, 2) as max_drawdown
    from p
    group by p.provider_id
  ) g;
$$;
GRANT EXECUTE ON FUNCTION public.provider_period_stats(integer) TO anon, authenticated;
