-- Rollback of 0271.
begin;
drop function if exists public.provider_roi_period(uuid[], int);
commit;
