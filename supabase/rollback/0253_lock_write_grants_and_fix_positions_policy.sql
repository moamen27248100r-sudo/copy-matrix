-- Rollback of 0253 (policies and grants as they were on 2026-10-12, before 0253).
begin;

grant insert, update, delete on public.signals to authenticated;
grant insert, update, delete on public.providers to authenticated;
grant insert, update, delete on public.simulated_positions to authenticated;

drop policy if exists simulated_positions_insert_admin on public.simulated_positions;
create policy simulated_positions_insert_admin on public.simulated_positions
  for insert to authenticated
  with check (
    (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
    and (exists (select 1 from public.signals s where s.id = simulated_positions.signal_id and s.created_by_admin = true))
  );

drop policy if exists simulated_positions_select_admin on public.simulated_positions;
create policy simulated_positions_select_admin on public.simulated_positions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists simulated_positions_update_admin on public.simulated_positions;
create policy simulated_positions_update_admin on public.simulated_positions
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop function if exists public.signal_created_by_admin(uuid);

commit;
