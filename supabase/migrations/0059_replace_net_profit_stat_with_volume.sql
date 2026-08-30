-- ============================================================
-- Copy Matrix — the homepage's "إجمالي الأرباح المحققة" stat summed
-- total_profit (wins minus losses) across all 1,924 leaders. That sum
-- is currently genuinely negative (-$69,551), which is expected once
-- a realistic share of leaders are struggling/high-risk archetypes —
-- but no real copy-trading platform publishes a marketing stat that
-- can go negative like that, and the tile was hard-coded green with
-- no RTL-aware sign handling, so a negative value rendered as a
-- garbled "69.6K-$" in success-green.
--
-- Replaces it with total trading volume: the notional size of every
-- position opened (open_signals + closed_signals, same base the
-- existing total_trades stat already uses) times the fixed $2,000
-- per-trade notional the platform's own P&L accounting already
-- assumes (see run_market_simulation()'s v_notional and the
-- total_profit recompute in 0057). It's a real, honestly-derived
-- number from the same accounting convention used elsewhere, and
-- it's non-negative by construction — unlike a net-profit sum.
-- ============================================================

drop function if exists public.homepage_platform_stats();

create or replace function public.homepage_platform_stats()
returns table (
  traders_with_followers bigint,
  total_followers bigint,
  total_trades bigint,
  total_volume numeric,
  best_daily_return numeric,
  weighted_win_rate numeric
)
language sql
stable
as $$
  with base as (
    select followers_count, open_signals, closed_signals, avg_daily_return_pct, win_rate_pct
    from public.provider_cards
  )
  select
    (select count(*) from base where followers_count > 0),
    (select coalesce(sum(followers_count), 0) from base),
    (select coalesce(sum(coalesce(open_signals, 0) + coalesce(closed_signals, 0)), 0) from base),
    (select coalesce(sum(coalesce(open_signals, 0) + coalesce(closed_signals, 0)), 0) * 2000 from base),
    (select max(avg_daily_return_pct) from base),
    (select round(sum(win_rate_pct * greatest(1, followers_count)) / nullif(sum(greatest(1, followers_count)), 0), 2)
     from base where win_rate_pct is not null);
$$;
