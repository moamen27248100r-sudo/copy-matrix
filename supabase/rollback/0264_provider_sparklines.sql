-- Rollback of 0264: the cards go back to one provider_daily_series call per trader.
begin;
drop function if exists public.provider_sparklines(uuid[], int);
commit;
