-- ============================================================
-- Copy Matrix — fix risk_level and expose account_capital.
--
-- risk_level was effectively broken: 0086 (which only meant to add a
-- `country` column) accidentally pasted the pre-0052 thresholds back
-- in (<1.9/<2.3/else), reintroducing a bug 0052 had already fixed
-- once (back then 1,120/1,124 leaders landed in 'مرتفعة'). Confirmed
-- live just now: 83% of the 1,924 leaders currently show 'مرتفعة',
-- only 8% show 'متوسطة'.
--
-- Instead of another one-off static recalibration (which will drift
-- again as the trading_style/skill-driven engine changes reshape the
-- platform's volatility distribution over time), tier boundaries are
-- now computed live as the 33rd/66th percentile of return_volatility
-- across leaders with real trade history — self-balancing forever.
--
-- Also exposes providers.account_capital (previously backend-only,
-- never selected by this view) so it can be displayed to customers.
-- ============================================================

create or replace view public.provider_cards as
with vol_pop as (
  select perf.provider_id, perf.return_volatility
  from public.provider_performance perf
  where perf.closed_signals >= 5 and perf.return_volatility is not null
),
vol_bounds as (
  select count(*) as n,
    percentile_cont(0.33) within group (order by return_volatility) as p33,
    percentile_cont(0.66) within group (order by return_volatility) as p66
  from vol_pop
)
select
  p.id as provider_id,
  p.bio,
  coalesce(pr.display_name, p.display_name) as display_name,
  coalesce(pf.followers_count, 0) + p.base_followers_count as followers_count,
  coalesce(perf.open_signals, 0) as open_signals,
  coalesce(perf.closed_signals, 0) as closed_signals,
  perf.win_rate_pct,
  perf.avg_return_pct,
  p.created_at as joined_at,
  p.total_profit,
  p.total_withdrawals,
  p.min_copy_amount,
  coalesce(perf.return_volatility, 2) as return_volatility,
  case
    when coalesce(perf.closed_signals, 0) < 5 then 'متوسطة'
    when vb.n < 30 then
      case
        when coalesce(perf.return_volatility, 2) < 3 then 'منخفضة'
        when coalesce(perf.return_volatility, 2) < 10 then 'متوسطة'
        else 'مرتفعة'
      end
    when perf.return_volatility < vb.p33 then 'منخفضة'
    when perf.return_volatility < vb.p66 then 'متوسطة'
    else 'مرتفعة'
  end as risk_level,
  round(greatest(0, least(100,
    45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
      (
        coalesce(perf.win_rate_pct, 50) * 0.6
        + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
        + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
      ) - 45
    )
  ))) as rating_score,
  case
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 75 then 'نخبة'
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 55 then 'محترف'
    when round(greatest(0, least(100,
      45 + least(1, coalesce(perf.closed_signals, 0) / 25.0) * (
        (
          coalesce(perf.win_rate_pct, 50) * 0.6
          + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
          + (8 - least(coalesce(perf.return_volatility, 2), 40)) * 3
        ) - 45
      )
    ))) >= 35 then 'متوسط'
    else 'مبتدئ'
  end as tier,
  perf.avg_daily_return_pct,
  p.country,
  p.account_capital
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id
cross join vol_bounds vb;
