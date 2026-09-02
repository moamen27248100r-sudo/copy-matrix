-- ============================================================
-- Copy Matrix — every provider's displayed profit has been computed
-- off the exact same flat $2000 "notional" for every single trade,
-- for every trader, regardless of who they are — no capital
-- diversity at all. Add a real per-provider account size and a real
-- per-signal lot size, so profit magnitude actually reflects (a) how
-- much real capital that trader is trading with and (b) how many
-- real pips that specific trade moved — instead of one constant
-- multiplier for the entire platform.
-- ============================================================

alter table public.providers add column if not exists account_capital numeric;
alter table public.signals add column if not exists lot_size numeric;
