-- ============================================================
-- Copy Matrix — the "average return" stat previously meant "average
-- % move per single trade", which is a meaningless unit to compare
-- traders by (someone with 5 trades a day looks the same as someone
-- with one, even though the daily result on the account is wildly
-- different). This adds a real average DAILY return per leader:
-- their total return summed and divided by the number of distinct
-- calendar days they actually closed at least one trade — a genuine
-- per-day figure computed straight from each leader's own trade
-- history, which moves on its own as real trades close each day
-- (no synthetic jitter needed).
-- ============================================================

create or replace view public.provider_performance as
select
  provider_id,
  count(*) filter (where status = 'open') as open_signals,
  count(*) filter (where status = 'closed') as closed_signals,
  round(
    count(*) filter (
      where status = 'closed'
        and ((side = 'buy' and exit_price > entry_price) or (side = 'sell' and exit_price < entry_price))
    )::numeric / nullif(count(*) filter (where status = 'closed'), 0) * 100,
    2
  ) as win_rate_pct,
  round(
    avg(
      case when status = 'closed'
        then (exit_price - entry_price) / entry_price * (case when side = 'sell' then -1 else 1 end) * 100
      end
    ),
    2
  ) as avg_return_pct,
  round(
    coalesce(stddev_pop(
      case when status = 'closed'
        then (exit_price - entry_price) / entry_price * (case when side = 'sell' then -1 else 1 end) * 100
      end
    ), 2),
    2
  ) as return_volatility,
  round(
    coalesce(
      sum(
        case when status = 'closed'
          then (exit_price - entry_price) / entry_price * (case when side = 'sell' then -1 else 1 end) * 100
        end
      ) / nullif(count(distinct case when status = 'closed' then closed_at::date end), 0),
      0
    ),
    2
  ) as avg_daily_return_pct
from public.signals
group by provider_id;

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
