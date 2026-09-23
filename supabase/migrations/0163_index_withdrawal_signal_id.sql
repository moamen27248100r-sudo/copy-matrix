-- Missing index found while preparing a bulk provider deletion: signal_id
-- on synthetic_customer_withdrawals had no index, so every ON DELETE SET
-- NULL cascade from a deleted signals row forced a sequential scan across
-- all ~527K withdrawal rows. Confirmed live: a 25-provider delete batch
-- hit a statement timeout on this exact UPDATE before the index existed,
-- and succeeded immediately after. Applied live via CREATE INDEX
-- CONCURRENTLY (must run outside a transaction, per project convention).

CREATE INDEX CONCURRENTLY IF NOT EXISTS synthetic_customer_withdrawals_signal_idx
  ON public.synthetic_customer_withdrawals (signal_id);
