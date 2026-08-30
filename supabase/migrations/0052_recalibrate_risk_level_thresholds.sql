-- ============================================================
-- Copy Matrix — the risk_level thresholds (< 1.9 low, < 2.3 medium,
-- else high) were calibrated back when every leader shared similar
-- move-size bands. With 1,124 leaders now spanning several real
-- archetypes (including the wide high-risk/high-reward batch), the
-- real return_volatility distribution is: ~44 leaders under 3, a
-- dominant cluster of ~1,010 between 3 and 10, and ~70 above 15 —
-- so the old thresholds classified 1,120 of 1,124 leaders as
-- "مرتفعة", which isn't a risk classification at all. Recalibrated
-- to the actual distribution so all three tiers are genuinely
-- populated.
-- ============================================================

create or replace view public.provider_cards as
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
    when coalesce(perf.return_volatility, 2) < 3 then 'منخفضة'
    when coalesce(perf.return_volatility, 2) < 10 then 'متوسطة'
    else 'مرتفعة'
  end as risk_level,
  round(greatest(0, least(100,
    coalesce(perf.win_rate_pct, 50) * 0.6
    + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
    + greatest(0, 8 - coalesce(perf.return_volatility, 4)) * 3
  ))) as rating_score,
  case
    when round(greatest(0, least(100,
      coalesce(perf.win_rate_pct, 50) * 0.6
      + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
      + greatest(0, 8 - coalesce(perf.return_volatility, 4)) * 3
    ))) >= 75 then 'نخبة'
    when round(greatest(0, least(100,
      coalesce(perf.win_rate_pct, 50) * 0.6
      + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
      + greatest(0, 8 - coalesce(perf.return_volatility, 4)) * 3
    ))) >= 55 then 'محترف'
    when round(greatest(0, least(100,
      coalesce(perf.win_rate_pct, 50) * 0.6
      + greatest(least(coalesce(perf.avg_return_pct, 0), 5), -5) * 6
      + greatest(0, 8 - coalesce(perf.return_volatility, 4)) * 3
    ))) >= 35 then 'متوسط'
    else 'مبتدئ'
  end as tier,
  perf.avg_daily_return_pct
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;
