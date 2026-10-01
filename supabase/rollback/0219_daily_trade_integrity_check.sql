-- ROLLBACK for 0219_daily_trade_integrity_check.sql: stops the daily job,
-- drops the check function and the windowed integrity function, and restores
-- the pre-0219 trade_integrity_issues() (captured via pg_get_functiondef()).
-- The reports table is kept (rename it away by hand if it must go).

begin;
select cron.unschedule(jobid) from cron.job where jobname = 'trade-integrity-daily';
drop function if exists public.run_trade_integrity_check(int);
drop function if exists public.trade_integrity_issues(timestamptz);
drop index if exists public.signals_closed_at_idx;
drop index if exists public.signals_opened_at_idx;
drop index if exists public.signals_provider_opened_idx;

CREATE OR REPLACE FUNCTION public.trade_integrity_issues()
 RETURNS TABLE(tbl text, row_id uuid, category text, detail text, flagged boolean)
 LANGUAGE sql
 STABLE
AS $function$
  with s as (
    select x.*, public.trade_dir(x.side) as dir,
      (x.exit_price - x.entry_price) * public.trade_dir(x.side) as d,
      (public.trade_levels(x.side, x.entry_price, x.stop_loss, x.take_profit)).ok as levels_ok
    from public.signals x
  ),
  sig as (
    -- direction / result
    select 'signals', id, 'direction_pnl', 'tp_with_loss', needs_review from s where close_trigger = 'tp' and d <= 0
    union all select 'signals', id, 'direction_pnl', 'sl_with_profit', needs_review from s where close_trigger = 'sl' and d >= 0
    union all select 'signals', id, 'direction_pnl', 'margin_call_with_profit', needs_review from s where close_trigger = 'margin_call' and d >= 0
    -- S/L and T/P placement
    union all select 'signals', id, 'sl_tp_order', 'sl_wrong_side', needs_review from s
      where stop_loss is not null and (stop_loss - entry_price) * dir >= 0
    union all select 'signals', id, 'sl_tp_order', 'tp_wrong_side', needs_review from s
      where take_profit is not null and (take_profit - entry_price) * dir <= 0
    -- close reason
    union all select 'signals', id, 'close_reason', 'reason_mismatch:' || coalesce(close_trigger, 'null'), needs_review from s
      where status = 'closed' and exit_price is not null and levels_ok
        and close_trigger is distinct from public.trade_close_trigger(side, entry_price, exit_price, stop_loss, take_profit, close_trigger)
    union all select 'signals', id, 'close_reason', 'exit_beyond_' || public.trade_exit_beyond_level(side, entry_price, exit_price, stop_loss, take_profit), needs_review from s
      where status = 'closed' and exit_price is not null and levels_ok
        and public.trade_exit_beyond_level(side, entry_price, exit_price, stop_loss, take_profit) is not null
    -- times
    union all select 'signals', id, 'times', 'closed_not_after_opened', needs_review from s where closed_at <= opened_at
    union all select 'signals', id, 'times', 'future_date', needs_review from s where opened_at > clock_timestamp() or closed_at > clock_timestamp()
    union all select 'signals', id, 'times', 'status_time_mismatch', needs_review from s
      where (status = 'closed' and closed_at is null) or (status = 'open' and closed_at is not null)
    -- values
    union all select 'signals', id, 'values', 'non_positive', needs_review from s
      where entry_price <= 0 or exit_price <= 0 or lot_size <= 0 or stop_loss <= 0 or take_profit <= 0
    union all select 'signals', id, 'values', 'missing_required', needs_review from s
      where symbol is null or side is null or entry_price is null
        or (status = 'closed' and (exit_price is null or close_trigger is null or lot_size is null))
    union all select 'signals', id, 'values', 'open_with_exit', needs_review from s
      where status = 'open' and (exit_price is not null or close_trigger is not null)
    union all select 'signals', id, 'values', 'duplicate', needs_review from (
      select id, needs_review, count(*) over (partition by provider_id, symbol, side, entry_price, opened_at) n from s) dup
      where n > 1
    -- price sanity
    union all select 'signals', id, 'price_range', 'out_of_band', needs_review from s
      where not (public.trade_price_in_band(symbol, entry_price) and public.trade_price_in_band(symbol, exit_price)
             and public.trade_price_in_band(symbol, stop_loss) and public.trade_price_in_band(symbol, take_profit))
  ),
  pos as (
    select 'simulated_positions', sp.id, 'direction_pnl', 'pnl_mismatch', sp.needs_review
      from public.simulated_positions sp join public.signals x on x.id = sp.signal_id
      where sp.status = 'closed' and sp.pnl is distinct from public.trade_position_pnl(x.side, sp.entry_price, sp.exit_price, sp.size)
        and abs(coalesce(sp.pnl, 1e9) - public.trade_position_pnl(x.side, sp.entry_price, sp.exit_price, sp.size)) > 0.01
    union all select 'simulated_positions', sp.id, 'direction_pnl', 'exit_differs_from_trade', sp.needs_review
      from public.simulated_positions sp join public.signals x on x.id = sp.signal_id
      where sp.status = 'closed' and sp.exit_price is distinct from x.exit_price
    union all select 'simulated_positions', sp.id, 'direction_pnl', 'open_on_closed_trade', sp.needs_review
      from public.simulated_positions sp join public.signals x on x.id = sp.signal_id
      where sp.status = 'open' and x.status = 'closed'
    union all select 'simulated_positions', sp.id, 'times', 'closed_not_after_opened', sp.needs_review
      from public.simulated_positions sp where sp.closed_at <= sp.opened_at
    union all select 'simulated_positions', sp.id, 'times', 'future_date', sp.needs_review
      from public.simulated_positions sp where sp.opened_at > clock_timestamp() or sp.closed_at > clock_timestamp()
    union all select 'simulated_positions', sp.id, 'values', 'non_positive', sp.needs_review
      from public.simulated_positions sp where sp.entry_price <= 0 or sp.exit_price <= 0 or sp.size <= 0
    union all select 'simulated_positions', sp.id, 'values', 'missing_required', sp.needs_review
      from public.simulated_positions sp
      where sp.status = 'closed' and (sp.exit_price is null or sp.pnl is null or sp.closed_at is null)
  )
  select * from sig union all select * from pos
$function$
 
;
revoke all on function public.trade_integrity_issues() from public, anon, authenticated;
commit;
