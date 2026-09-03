-- Expose the new providers.country column through provider_cards (the view
-- almost every trader-facing query reads from) so the trader profile page
-- and discover cards can show a flag for the leaders given an international
-- identity. Everything else in this view is unchanged from 0060.
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
  perf.avg_daily_return_pct,
  p.country
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;
