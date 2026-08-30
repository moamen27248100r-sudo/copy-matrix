-- ============================================================
-- Copy Matrix — 0056's fix wasn't enough: PostgreSQL can still
-- reuse (materialize) the output of a LATERAL subquery across
-- multiple outer rows when the subquery doesn't textually reference
-- the outer row, even placed after a real join in a derived table —
-- so random() kept getting evaluated far fewer times than there were
-- rows, and leaders still came out at 100%/0% win rate with repeated
-- identical trade percentages.
--
-- This version draws the random values as plain projected columns
-- in an ordinary (non-lateral) join — genuinely one row per trade,
-- each with its own real random() call — then applies pure
-- deterministic arithmetic on those already-fixed values in a second
-- step. No lateral subquery anywhere, so there's nothing left for
-- the planner to hoist or reuse.
-- ============================================================

with rolls as (
  select
    sg.id,
    (random() < pv.skill) as is_win,
    random() as move_roll,
    pv.risk_archetype,
    pv.rr_ratio
  from public.signals sg
  join public.providers pv on pv.id = sg.provider_id
  where sg.status = 'closed'
    and pv.risk_archetype is not null
    and pv.risk_archetype <> 'flagship'
    and pv.user_id is null
),
computed as (
  select
    id,
    is_win,
    case risk_archetype
      when 'stable' then 0.005 + move_roll * 0.015
      when 'balanced' then 0.010 + move_roll * 0.040
      when 'high_risk' then 0.05 + move_roll * 0.30
      when 'struggling' then case when is_win then 0.005 + move_roll * 0.010 else 0.020 + move_roll * 0.070 end
      when 'good_rr' then case when is_win then (0.01 + move_roll * 0.03) * rr_ratio else 0.01 + move_roll * 0.03 end
    end as move
  from rolls
)
update public.signals s
set exit_price = round((
    case when c.is_win
      then s.entry_price * (1 + (case when s.side = 'buy' then 1 else -1 end) * c.move)
      else s.entry_price * (1 - (case when s.side = 'buy' then 1 else -1 end) * c.move)
    end
  )::numeric, 4)
from computed c
where s.id = c.id;

-- Re-plant one real margin-call-level loss for ~35% of high_risk
-- leaders, redrawn fresh since the underlying history just changed.
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
