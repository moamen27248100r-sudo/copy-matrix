-- Rollback of 0262: no default watchlist for new customers (existing rows are kept).
begin;
drop trigger if exists trg_profiles_default_watchlist on public.profiles;
drop function if exists public.seed_default_watchlist();
commit;
