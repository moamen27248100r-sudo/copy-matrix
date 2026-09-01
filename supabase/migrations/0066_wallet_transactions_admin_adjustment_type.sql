-- ============================================================
-- Copy Matrix — allow a manual admin balance correction to be
-- recorded in wallet_transactions like every other balance change,
-- instead of being invisible to the user's own transaction history.
-- ============================================================

alter table public.wallet_transactions drop constraint wallet_transactions_type_check;

alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type in ('deposit', 'withdrawal', 'pnl', 'fee', 'admin_adjustment'));
