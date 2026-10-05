-- Visitors can't read providers, so a policy subquery on it saw no real
-- leaders at all for them. The real (non-simulated) leader ids now come from
-- a security definer helper, evaluated once per query.

create or replace function public.real_provider_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.providers where not is_simulated;
$$;
grant execute on function public.real_provider_ids() to anon, authenticated;

drop policy if exists signals_select on public.signals;
create policy signals_select on public.signals for select to authenticated
  using (
    (not hidden and ((select public.viewer_sees_simulated()) or provider_id = any (coalesce((select public.real_provider_ids()), '{}'))))
    -- Hidden (retired) trades stay visible to whoever copied them.
    or (hidden and exists (select 1 from public.simulated_positions sp where sp.signal_id = signals.id and sp.follower_id = auth.uid()))
  );

drop policy if exists signals_select_public on public.signals;
create policy signals_select_public on public.signals for select to anon
  using (not hidden and provider_id = any (coalesce((select public.real_provider_ids()), '{}')));

drop policy if exists trader_posts_select_public on public.trader_posts;
create policy trader_posts_select_public on public.trader_posts for select to anon, authenticated
  using (provider_id = any (coalesce((select public.real_provider_ids()), '{}')) or (select public.viewer_sees_simulated()));
