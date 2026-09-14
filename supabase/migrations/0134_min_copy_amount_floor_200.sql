-- ============================================================
-- Copy Matrix — correction to 0132: the one-time min_copy_amount
-- rescale floored at $50, but the platform's actual minimum is $200
-- (matching the live engine's ongoing drift floor, greatest(200, ...)
-- in run_market_simulation() -- unchanged, was already correct).
-- 181 providers ended up below $200 after 0132's rescale; raised back
-- up to the $200 floor. Everything above $200 (the performance-scaled
-- part) is untouched.
-- ============================================================

update public.providers
set min_copy_amount = 200
where min_copy_amount < 200;
