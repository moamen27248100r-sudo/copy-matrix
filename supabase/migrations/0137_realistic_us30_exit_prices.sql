-- ============================================================
-- Copy Matrix — explicit request: review the historical (closed) US30
-- trades for realism, since US30 never had a real price feed to keep
-- it grounded (0135 already stopped all future US30 trades for that
-- reason).
--
-- Audited first rather than guessing:
--   - Win/loss internal consistency: PERFECT across all 25,759 closed
--     rows (every close_trigger='tp' row is genuinely a win given
--     side/entry/exit, every 'sl' row genuinely a loss, and exit_price
--     always exactly matches the recorded take_profit/stop_loss level
--     that triggered it). Nothing to fix there.
--   - Entry prices: tight and realistic everywhere ($38,610-$39,390,
--     matching the platform's own $39,000 anchor constant) -- and
--     critically, each INDIVIDUAL leader's own trade history (what a
--     reviewer actually looks at) stays in that same tight band, even
--     though the platform-wide min/max looked wild ($15,234-$67,128).
--   - Exit prices: the real problem -- 845 of 25,759 rows (3.3%,
--     across 67 leaders) show single-trade moves of 30%+ on an index.
--     Root cause: the "high_risk" trading-style archetype's move-size
--     formula (5-25% base, up to ~125%+ on a skilled win) was tuned
--     for crypto, where that kind of swing is at least plausible --
--     applied to an index-type symbol like US30, it produces moves no
--     real index ever makes in one holding period. This is the
--     specific thing that would look obviously fake to a reviewer.
--
-- Fix: cap just those 845 outlier rows' exit_price to a generous
-- +/-5% move from entry (a genuinely extreme single-session move for
-- a real index, so still reads as "high risk", just not impossible) --
-- preserving the win/loss direction exactly, and re-deriving
-- take_profit/stop_loss to match the new exit_price wherever that
-- level is what triggered the close (keeping the tp/sl-matches-exit
-- consistency verified above intact). The other 24,914 rows are
-- already realistic and untouched.
-- ============================================================

with capped as (
  select
    id,
    entry_price + sign(exit_price - entry_price) * least(abs(exit_price - entry_price), entry_price * 0.05) as new_exit
  from public.signals
  where symbol = 'US30' and status = 'closed'
    and (entry_price < 30000 or entry_price > 50000 or exit_price < 30000 or exit_price > 50000)
)
update public.signals s
set
  exit_price = round(capped.new_exit::numeric, 4),
  take_profit = case when s.close_trigger = 'tp' then round(capped.new_exit::numeric, 4) else s.take_profit end,
  stop_loss = case when s.close_trigger = 'sl' then round(capped.new_exit::numeric, 4) else s.stop_loss end
from capped
where s.id = capped.id;
