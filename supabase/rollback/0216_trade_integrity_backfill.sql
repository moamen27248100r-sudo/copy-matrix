-- ROLLBACK for 0216_trade_integrity_backfill.sql.
-- Run supabase/rollback/0217_trade_integrity_guards.sql FIRST (the guard
-- trigger and CHECK constraints would reject restoring the old values).
--
-- Restores every field 0216 changed from the 2026-10-01 backups. Only the
-- columns 0216 touched are restored, so trades opened/closed since then
-- keep their live state. The backup tables and audit log are kept.

begin;
set local statement_timeout = 0;

update public.signals s
set stop_loss = b.stop_loss,
    take_profit = b.take_profit,
    close_trigger = b.close_trigger,
    needs_review = false,
    review_reasons = null
from public._bak_20261001_signals b
where b.id = s.id
  and (s.stop_loss is distinct from b.stop_loss
    or s.take_profit is distinct from b.take_profit
    or s.close_trigger is distinct from b.close_trigger
    or s.needs_review);

update public.simulated_positions sp
set needs_review = false, review_reasons = null
from public._bak_20261001_simulated_positions b
where b.id = sp.id and sp.needs_review;

commit;

refresh materialized view public.provider_performance_mv;
