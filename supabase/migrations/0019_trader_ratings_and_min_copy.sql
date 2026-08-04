-- ============================================================
-- Copy Matrix — full trader profile ratings: a risk level and
-- volatility measure computed from each leader's real closed
-- trades (not arbitrary), a composite 0-100 rating score, a
-- tier classification, and a varied minimum copy amount per
-- leader so the discover/profile pages can show a proper,
-- professional-looking evaluation instead of just win rate.
-- ============================================================

alter table public.providers
  add column min_copy_amount numeric not null default 50;

update public.providers
set min_copy_amount = (array[25, 50, 75, 100, 150, 200, 250, 300, 500])[1 + floor(random() * 9)::int];

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
  ) as return_volatility
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
  end as tier
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;
