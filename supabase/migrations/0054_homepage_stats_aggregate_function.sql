-- ============================================================
-- Copy Matrix — the homepage stats section fetched every row from
-- provider_cards into JS and summed them there. Supabase's REST API
-- caps a single select() at 1,000 rows by default; with the roster
-- now at 1,924 leaders, every homepage stat (active traders, total
-- copiers, total trades, total profit, weighted win rate, best daily
-- return) was silently computed from only the first 1,000 leaders —
-- undercounting all of them without any error.
--
-- Moves the aggregation into a single SQL function that computes
-- every number directly in Postgres across the full table, so there's
-- no row cap to hit no matter how large the roster grows.
-- ============================================================

create or replace function public.homepage_platform_stats()
returns table (
  traders_with_followers bigint,
  total_followers bigint,
  total_trades bigint,
  total_profit numeric,
  best_daily_return numeric,
  weighted_win_rate numeric
)
language sql
stable
as $$
  with base as (
    select followers_count, open_signals, closed_signals, total_profit, avg_daily_return_pct, win_rate_pct
    from public.provider_cards
  )
  select
    (select count(*) from base where followers_count > 0),
    (select coalesce(sum(followers_count), 0) from base),
    (select coalesce(sum(coalesce(open_signals, 0) + coalesce(closed_signals, 0)), 0) from base),
    (select coalesce(sum(total_profit), 0) from base),
    (select max(avg_daily_return_pct) from base),
    (select round(sum(win_rate_pct * greatest(1, followers_count)) / nullif(sum(greatest(1, followers_count)), 0), 2)
     from base where win_rate_pct is not null);
$$;
