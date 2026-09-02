-- ============================================================
-- Copy Matrix — real historical price series per symbol, populated
-- once by scripts/backfill-price-history.mjs (Binance hourly klines
-- for crypto/gold, frankfurter.app daily history for forex) and used
-- to rewrite the platform's 241K+ existing signals with genuinely
-- real entry/exit prices instead of fabricated ones.
-- ============================================================

create table public.price_history (
  symbol text not null,
  ts timestamptz not null,
  price numeric not null,
  primary key (symbol, ts)
);

create index price_history_symbol_ts_idx on public.price_history (symbol, ts);

alter table public.price_history enable row level security;

create policy "price_history_select_all" on public.price_history
  for select to authenticated using (true);
