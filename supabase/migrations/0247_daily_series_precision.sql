-- The profile's equity curve compounds provider_daily_series' daily returns; rounded to 6
-- decimals they drift from roi_all over a multi-year record (e.g. +129.54% on the chart
-- for a stored +129.53%). 12 decimals keeps the curve and the stats on the same number.
-- Rollback: re-run the previous definition (round(..., 6)) from 0234.

create or replace function public.provider_daily_series(p_provider_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when not exists (
      select 1 from public.providers p
      where p.id = p_provider_id and (not p.is_simulated or public.viewer_sees_simulated() or p.user_id = auth.uid()))
    then null
    else (
      select jsonb_build_object(
        'days', coalesce(jsonb_agg(d.day order by d.day), '[]'::jsonb),
        'ret', coalesce(jsonb_agg(round(case when d.start_equity + d.cash_flow > 0 then d.pnl / (d.start_equity + d.cash_flow) else 0 end, 12) order by d.day), '[]'::jsonb),
        'trades', coalesce(jsonb_agg(d.trades order by d.day), '[]'::jsonb),
        'wins', coalesce(jsonb_agg(d.wins order by d.day), '[]'::jsonb),
        'pnl', coalesce(jsonb_agg(round(d.pnl, 2) order by d.day), '[]'::jsonb),
        'equity', coalesce(jsonb_agg(round(d.start_equity + d.cash_flow + d.pnl, 2) order by d.day), '[]'::jsonb))
      from public.provider_daily d where d.provider_id = p_provider_id)
    end
$$;
