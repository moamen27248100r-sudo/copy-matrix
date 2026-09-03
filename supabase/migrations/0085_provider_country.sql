-- Nullable: only a small, deliberately chosen set of leaders get a country
-- (and a matching international identity + instrument bias) — the rest of
-- the roster is untouched and shows no flag.
alter table public.providers add column country text;
