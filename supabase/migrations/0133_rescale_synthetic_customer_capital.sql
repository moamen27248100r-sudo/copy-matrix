-- ============================================================
-- Copy Matrix — proportional rescale of the ~188K existing
-- synthetic_customers rows to match the new, more realistic capital
-- ceiling introduced in 0132 (500 + max(0, skill-0.35)^2 * 150000,
-- replacing the old 5000 + max(0, skill-0.2) * 85000).
--
-- Deliberately a proportional SCALE, not a re-roll: each customer's
-- starting_capital and current_capital are multiplied by the same
-- factor (new_ceiling / old_ceiling for their specific leader), so
-- their relative standing among that leader's customers and their
-- full compounding history (current vs starting) are preserved
-- exactly -- only the absolute dollar scale comes down to something
-- realistic. A customer who was already twice as rich as another
-- under the old leader stays twice as rich under the new one.
-- ============================================================

with factors as (
  select
    id as provider_id,
    (500 + power(greatest(0, coalesce(skill, 0.55) - 0.35), 2) * 150000) as new_ceiling,
    (5000 + greatest(0, coalesce(skill, 0.55) - 0.2) * 85000) as old_ceiling
  from public.providers
)
update public.synthetic_customers sc
set
  starting_capital = greatest(10, round((sc.starting_capital * (f.new_ceiling / f.old_ceiling))::numeric, 2)),
  current_capital = greatest(10, round((sc.current_capital * (f.new_ceiling / f.old_ceiling))::numeric, 2))
from factors f
where f.provider_id = sc.provider_id;
