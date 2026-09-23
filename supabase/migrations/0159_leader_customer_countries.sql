-- Geographic localization: every leader and every synthetic customer gets a
-- country (previously only the 50-leader curated international roster had
-- one; everyone else showed no flag). synthetic_customers gains its own
-- country column, matched to their leader's country ~90% of the time (a
-- customer base that's mostly-but-not-only local to their leader), else a
-- random other country -- mirroring the existing pickName() split in
-- scripts/backfill-synthetic-customers.mjs.
alter table public.synthetic_customers add column if not exists country text;
