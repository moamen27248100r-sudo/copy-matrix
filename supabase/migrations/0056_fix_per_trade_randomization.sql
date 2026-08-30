-- ============================================================
-- Copy Matrix — 0055's re-roll had a real bug: the LATERAL
-- subqueries computing is_win/move only referenced the provider
-- (pv), and PostgreSQL doesn't allow an UPDATE...FROM lateral item
-- to correlate to the UPDATE target table — so it silently evaluated
-- random() once per PROVIDER and reused that same result across
-- every one of their trades. Leaders came out with impossible 100%
-- or 0% win rates and identical % moves repeated across many trades.
--
-- Fixes it by computing the new exit prices in an independent
-- subquery first (a plain join of signals + providers, where the
-- signal row is a genuine FROM-list member so random() legitimately
-- runs once per trade), then joining that result back to the UPDATE
-- target by id. Re-rolls every non-flagship leader's history again
-- with that fix, replants the high_risk margin-call losses, and
-- recomputes total_profit.
-- ============================================================

update public.signals s
set exit_price = calc.new_exit_price
from (
  select
    sg.id,
    round((
      case when w.is_win
        then sg.entry_price * (1 + (case when sg.side = 'buy' then 1 else -1 end) * m.move)
        else sg.entry_price * (1 - (case when sg.side = 'buy' then 1 else -1 end) * m.move)
      end
    )::numeric, 4) as new_exit_price
  from public.signals sg
  join public.providers pv on pv.id = sg.provider_id
  cross join lateral (select (random() < pv.skill) as is_win) w
  cross join lateral (
    select case pv.risk_archetype
      when 'stable' then 0.005 + random() * 0.015
      when 'balanced' then 0.010 + random() * 0.040
      when 'high_risk' then 0.05 + random() * 0.30
      when 'struggling' then (case when w.is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end)
      when 'good_rr' then (case when w.is_win then (0.01 + random() * 0.03) * pv.rr_ratio else 0.01 + random() * 0.03 end)
    end as move
  ) m
  where sg.status = 'closed'
    and pv.risk_archetype is not null
    and pv.risk_archetype <> 'flagship'
    and pv.user_id is null
) calc
where s.id = calc.id;

-- Re-plant one real margin-call-level loss for ~35% of high_risk
-- leaders (the previous plant is still a valid real row, but redraw
-- the cohort fresh since the underlying history just changed again).
with candidates as (
  select id from public.providers where risk_archetype = 'high_risk' and random() < 0.35
),
picks as (
  select distinct on (s.provider_id) s.id, s.side, s.entry_price
  from public.signals s
  join candidates c on c.id = s.provider_id
  where s.status = 'closed'
  order by s.provider_id, random()
)
update public.signals s
set exit_price = round((
    case when s.side = 'buy' then s.entry_price * (1 - (0.20 + random() * 0.20))
         else s.entry_price * (1 + (0.20 + random() * 0.20))
    end
  )::numeric, 4)
from picks
where s.id = picks.id;

update public.providers p
set total_profit = coalesce((
  select round(sum(
    2000 * ((s.exit_price - s.entry_price) / s.entry_price) * (case when s.side = 'sell' then -1 else 1 end)
  )::numeric, 2)
  from public.signals s
  where s.provider_id = p.id and s.status = 'closed'
), 0)
where p.risk_archetype is not null and p.risk_archetype <> 'flagship' and p.user_id is null;
