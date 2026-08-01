-- ============================================================
-- Copy Matrix — flattened provider card view for the discovery
-- feed and provider profile page (avoids nested embedding).
-- ============================================================

create view public.provider_cards as
select
  p.id as provider_id,
  p.bio,
  pr.display_name,
  coalesce(pf.followers_count, 0) as followers_count,
  coalesce(perf.open_signals, 0) as open_signals,
  coalesce(perf.closed_signals, 0) as closed_signals,
  perf.win_rate_pct,
  perf.avg_return_pct
from public.providers p
join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;
