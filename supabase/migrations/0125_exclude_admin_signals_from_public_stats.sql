-- ============================================================
-- Copy Matrix — created_by_admin signals (manual corrections, margin
-- calls, and the upcoming density-mechanic phantom positions for real
-- copying customers) were never meant to represent a leader's own
-- trading record. Until now this table only ever held 3 such rows, so
-- it went unnoticed, but the density mechanic is about to generate a
-- continuous stream of these per real customer -- without this fix
-- they'd inflate a leader's public open_signals count and skew their
-- win_rate/avg_return with trades that aren't really theirs.
--
-- provider_cards is NOT redefined here -- it joins provider_performance
-- by column name, so this fix propagates automatically. (Confirmed live:
-- re-emitting provider_cards from an older snapshot of its definition
-- fails outright with "cannot drop columns from view", since later
-- migrations added country/account_capital/trading_status/margin_called_at
-- to it that aren't safe to reconstruct from memory -- a real, useful
-- guardrail against exactly this mistake.)
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
where not created_by_admin
group by provider_id;
