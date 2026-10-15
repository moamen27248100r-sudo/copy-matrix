-- 0264: the small return curves on trader cards, for many traders in one call.
-- Rollback: supabase/rollback/0264_provider_sparklines.sql
--
-- provider_sparklines(ids, days) returns, for each visible trader, the cumulative return in percent
-- over its last `days` daily rows (starting at 0), the same series the cards drew one trader at a
-- time with provider_daily_series. Visibility follows provider_daily_series: a simulated trader only
-- for viewers who can see simulated traders (or the trader's own account).

begin;

create or replace function public.provider_sparklines(p_ids uuid[], p_days int default 30)
returns table (provider_id uuid, series numeric[])
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select p.id
    from public.providers p
    where p.id = any (p_ids)
      and (not p.is_simulated or public.viewer_sees_simulated() or p.user_id = auth.uid())
  ),
  recent as (
    select d.provider_id, d.day,
           case when d.start_equity + d.cash_flow > 0 then d.pnl / (d.start_equity + d.cash_flow) else 0 end as r,
           row_number() over (partition by d.provider_id order by d.day desc) as rn
    from public.provider_daily d
    join visible v on v.id = d.provider_id
  ),
  curve as (
    select provider_id, day,
           (exp(sum(ln(greatest(1e-9, 1 + r))) over (partition by provider_id order by day)) - 1) * 100 as v
    from recent
    where rn <= least(greatest(coalesce(p_days, 30), 2), 365)
  )
  select provider_id, array[0::numeric] || array_agg(round(v::numeric, 4) order by day)
  from curve
  group by provider_id
$$;

revoke execute on function public.provider_sparklines(uuid[], int) from public;
grant execute on function public.provider_sparklines(uuid[], int) to anon, authenticated;

commit;
