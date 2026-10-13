-- Rollback for 0254: removes the dashboard RPCs (the app falls back to nothing: deploy the previous
-- code first if you roll back after the dashboard was switched to dashboard_summary).
begin;
drop function if exists public.dashboard_summary(text);
drop function if exists public.benchmark_series(text, integer);
commit;
