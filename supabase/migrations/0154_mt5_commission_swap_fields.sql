-- MT5-standard trade fields: commission and swap. Both are small, realistic,
-- deterministic-per-symbol-type constants (crypto pairs don't carry swap the
-- way forex/gold do; commission scales with lot_size like a real broker's
-- per-lot fee) -- computed once, at close, alongside the existing pnl.
alter table public.signals
  add column if not exists commission numeric,
  add column if not exists swap numeric;

comment on column public.signals.commission is 'Flat per-lot commission charged at close, USD (MT5-style).';
comment on column public.signals.swap is 'Overnight financing charge/credit accrued while the position was open, USD. 0 for crypto pairs (perpetual, no swap) and same-day closes.';
