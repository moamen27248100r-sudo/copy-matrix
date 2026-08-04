-- ============================================================
-- Copy Matrix — simple table-based rate limiting. Vercel functions
-- are stateless, so an in-memory limiter would reset every
-- invocation; this uses Postgres as the shared counter instead.
-- ============================================================

create table public.rate_limits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index rate_limits_key_created_idx on public.rate_limits (key, created_at);

alter table public.rate_limits enable row level security;
-- No select/insert policies for anon/authenticated: all access goes
-- through the security-definer function below, so a client can never
-- read or clear its own rate-limit history.

create function public.check_rate_limit(p_key text, p_max_attempts int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rate_limits
  where key = p_key and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count from public.rate_limits where key = p_key;

  if v_count >= p_max_attempts then
    return false;
  end if;

  insert into public.rate_limits (key) values (p_key);
  return true;
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
