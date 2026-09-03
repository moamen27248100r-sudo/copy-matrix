-- Public "trader posts" feed for the landing page: short, system-generated
-- commentary tied to a trader's own real closed signal. No client write
-- policy — rows are only ever inserted by generate_trader_posts() (0088).
create table public.trader_posts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  signal_id uuid references public.signals (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.trader_posts enable row level security;

create policy "trader_posts_select_public" on public.trader_posts
  for select to anon, authenticated
  using (true);

create index trader_posts_created_at_idx on public.trader_posts (created_at desc);
