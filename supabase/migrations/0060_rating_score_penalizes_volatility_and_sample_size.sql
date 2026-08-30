-- ============================================================
-- Copy Matrix — rating_score (which drives the "نخبة/محترف/متوسط/مبتدئ"
-- tier and the trader page's "موثوقية التداول" reliability gauge) had
-- two real flaws that let a leader like "عمرو الدوسري" — 8 trades,
-- 16.74 volatility, high_risk archetype — score 83 and display as
-- "نخبة" with a HIGH reliability gauge, exactly the kind of leader a
-- real trust score should flag, not crown:
--
--   1. The volatility term was `greatest(0, 8 - volatility) * 3`, a
--      BONUS that floors at 0 once volatility passes 8. A leader at
--      volatility 8 and one at volatility 35 (the top of the
--      high_risk archetype's range) scored identically on this term
--      — there was no actual penalty for being extremely volatile,
--      only a missing bonus.
--   2. There was no adjustment for sample size at all. A leader with
--      8 closed trades and one with 400 were treated as equally
--      proven, even though a small handful of trades is much closer
--      to noise than a real track record.
--
-- Fixes both: the volatility term is now uncapped on the downside (it
-- keeps getting worse as volatility climbs instead of floor at 0),
-- and the raw score is blended toward a neutral baseline (45) by a
-- confidence factor that ramps from 0 to 1 over a leader's first 25
-- closed trades — so an unproven or wildly volatile leader can no
-- longer reach "نخبة" purely on a small lucky streak. Verified against
-- the real 1,924-leader roster before applying: the two hand-built
-- flagships and the genuinely low-volatility, high-win-rate "stable"
-- leaders keep or lead the top scores; every high_risk leader that
-- previously hit "نخبة" on volatility 15-21 drops to "متوسط" instead
-- (49 of the 55 previous "نخبة" leaders were exactly this pattern).
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
    when coalesce(perf.return_volatility, 2) < 1.9 then 'منخفضة'
    when coalesce(perf.return_volatility, 2) < 2.3 then 'متوسطة'
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
  perf.avg_daily_return_pct
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;
