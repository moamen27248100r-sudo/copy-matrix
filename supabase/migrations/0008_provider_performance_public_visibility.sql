-- ============================================================
-- Copy Matrix — provider_performance must run in owner mode (no
-- security_invoker) so anonymous/logged-out visitors can see
-- public win-rate stats via provider_cards, matching the fix
-- already applied in production. Without this, an anon session
-- re-checks signals RLS and every stat collapses to null.
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
  ) as avg_return_pct
from public.signals
group by provider_id;
