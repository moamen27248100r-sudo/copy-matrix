-- Rollback for 0257: removes the read-only helper.
begin;
drop function if exists public.leader_adjusted_drawdown(uuid[], integer);
commit;
