-- ============================================================
-- Copy Matrix — "متابعة" (follow) is being split apart from "نسخ"
-- (copy). Following a trader is free, unlimited, and has nothing to
-- do with allocating money — it just means you can watch their trade
-- history. Copying (public.subscriptions) stays the paid, single-
-- trader-at-a-time relationship it already was.
-- ============================================================

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, provider_id)
);

alter table public.follows enable row level security;

create policy follows_select_own on public.follows
  for select using (follower_id = auth.uid());

create policy follows_insert_own on public.follows
  for insert with check (follower_id = auth.uid());

create policy follows_delete_own on public.follows
  for delete using (follower_id = auth.uid());
