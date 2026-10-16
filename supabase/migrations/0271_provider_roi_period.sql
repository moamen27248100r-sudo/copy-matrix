-- 0271: a leader's compounded return over the last N days (12 months for the home-page and landing
-- cards), computed from the daily rows with the same formula the 7/30/90/180-day figures use
-- (refresh_provider_stats). provider_daily is private, so this is a security-definer function that
-- returns only the aggregate, only for leaders that are listed (not archived), and only for at
-- most 50 leaders per call.
-- Rollback: supabase/rollback/0271_provider_roi_period.sql

begin;

create or replace function public.provider_roi_period(p_ids uuid[], p_days int default 365)
returns table (provider_id uuid, roi numeric, days_counted int)
language sql
stable
security definer
set search_path = public
as $$
  select pd.provider_id,
         round(100 * (exp(sum(ln(greatest(1e-9, 1 + case when pd.start_equity + pd.cash_flow > 0 then pd.pnl / (pd.start_equity + pd.cash_flow) else 0 end)))) - 1), 2) as roi,
         count(*)::int as days_counted
  from public.provider_daily pd
  join public.providers p on p.id = pd.provider_id and not p.is_archived
  where pd.provider_id = any (p_ids[1:50])
    and (current_date - pd.day) < greatest(1, least(coalesce(p_days, 365), 3650))
  group by pd.provider_id
$$;

revoke all on function public.provider_roi_period(uuid[], int) from public;
grant execute on function public.provider_roi_period(uuid[], int) to anon, authenticated, service_role;

commit;
