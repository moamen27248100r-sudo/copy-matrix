-- Root cause of the slow/occasionally-timing-out home page and discover-page
-- queries: provider_cards joins provider_performance, a plain VIEW that
-- aggregates the ENTIRE signals table (377k+ rows and growing) with GROUP BY
-- provider_id -- recomputed from scratch on every single read, and TWICE per
-- provider_cards query (once directly, once again for the vol_pop CTE).
-- Measured: ~1.9s per full aggregate scan, ~3.4s total for one
-- "top 10 providers" query, occasionally exceeding the statement timeout.
--
-- A single provider's own lookup (provider_performance WHERE provider_id = X,
-- e.g. from the live engine) is NOT the problem -- that already uses
-- signals_provider_id_status_idx and returns in under 1ms, confirmed via
-- EXPLAIN. Only the whole-table aggregate behind provider_cards is slow, so
-- this only needs to be computed once per refresh, not once per request.
--
-- Fix: materialize it and refresh once a minute -- the same cadence
-- run_market_simulation() itself already runs at, so this adds no meaningful
-- staleness (a leader's numbers already only move on that same per-minute
-- cron tick). provider_performance stays a view with the exact same columns,
-- now a thin passthrough over the materialized data, so every existing
-- consumer (provider_cards, and one-off migrations that read it) keeps
-- working unchanged.

create materialized view public.provider_performance_mv as
select provider_id,
    count(*) filter (where status = 'open'::text) as open_signals,
    count(*) filter (where status = 'closed'::text) as closed_signals,
    round(count(*) filter (where status = 'closed'::text and (side = 'buy'::text and exit_price > entry_price or side = 'sell'::text and exit_price < entry_price))::numeric / nullif(count(*) filter (where status = 'closed'::text), 0)::numeric * 100::numeric, 2) as win_rate_pct,
    round(avg(
        case
            when status = 'closed'::text then (exit_price - entry_price) / entry_price *
            case
                when side = 'sell'::text then '-1'::integer
                else 1
            end::numeric * 100::numeric
            else null::numeric
        end), 2) as avg_return_pct,
    round(coalesce(stddev_pop(
        case
            when status = 'closed'::text then (exit_price - entry_price) / entry_price *
            case
                when side = 'sell'::text then '-1'::integer
                else 1
            end::numeric * 100::numeric
            else null::numeric
        end), 2::numeric), 2) as return_volatility,
    round(coalesce(sum(
        case
            when status = 'closed'::text then (exit_price - entry_price) / entry_price *
            case
                when side = 'sell'::text then '-1'::integer
                else 1
            end::numeric * 100::numeric
            else null::numeric
        end) / nullif(count(distinct
        case
            when status = 'closed'::text then closed_at::date
            else null::date
        end), 0)::numeric, 0::numeric), 2) as avg_daily_return_pct
from public.signals
where not created_by_admin
group by provider_id;

-- Required for REFRESH ... CONCURRENTLY (readers keep seeing the old data
-- during a refresh instead of being blocked).
create unique index provider_performance_mv_provider_id_idx
  on public.provider_performance_mv (provider_id);

-- Same columns, same order, same types as the live view it replaces --
-- every existing consumer keeps working unchanged.
create or replace view public.provider_performance as
select * from public.provider_performance_mv;

create or replace function public.refresh_provider_performance()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently public.provider_performance_mv;
end;
$$;

select cron.schedule(
  'refresh-provider-performance',
  '* * * * *',
  $$select public.refresh_provider_performance();$$
);
