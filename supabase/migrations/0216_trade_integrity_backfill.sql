-- Trade integrity, part 2: one-off correction of existing trade history.
-- Rollback: supabase/rollback/0216_trade_integrity_backfill.sql
--
-- Source of truth is side + entry_price + exit_price; those three (and the
-- times) are never changed here. What is corrected from them:
--   * stop_loss / take_profit stored in each other's column -> swapped back
--   * close_trigger -> re-derived from the prices and the (fixed) levels
-- What can't be derived from the row itself is NOT invented: the trade is
-- flagged needs_review with the reasons listed, and left as-is.
-- Every change is written to trade_audit_log. No row is deleted.

begin;
set local statement_timeout = 0;

-- 1. Full backups (admin-read only) ----------------------------------------
create table public._bak_20261001_signals as select * from public.signals;
create table public._bak_20261001_simulated_positions as select * from public.simulated_positions;
alter table public._bak_20261001_signals add primary key (id);
alter table public._bak_20261001_simulated_positions add primary key (id);

do $$
declare t text;
begin
  foreach t in array array['_bak_20261001_signals', '_bak_20261001_simulated_positions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))', t || '_select_admin', t);
  end loop;
end $$;

-- 2. Work out the corrected values for every signal ------------------------
create temp table fix on commit drop as
with base as (
  select s.id, s.side, s.symbol, s.status, s.entry_price, s.exit_price, s.lot_size,
    s.stop_loss, s.take_profit, s.close_trigger, s.opened_at, s.closed_at,
    l.sl as new_sl, l.tp as new_tp, l.ok as levels_ok,
    count(*) over (partition by s.provider_id, s.symbol, s.side, s.entry_price, s.opened_at) as dup_n
  from public.signals s
  cross join lateral public.trade_levels(s.side, s.entry_price, s.stop_loss, s.take_profit) l
)
select b.*,
  case
    when b.status <> 'closed' or b.exit_price is null or not b.levels_ok then b.close_trigger
    else public.trade_close_trigger(b.side, b.entry_price, b.exit_price, b.new_sl, b.new_tp,
      -- a stored tp/sl/breakeven the prices don't support was a timed close
      case when b.close_trigger in ('tp', 'sl', 'breakeven') then 'timeout' else b.close_trigger end)
  end as new_trigger,
  array_remove(array[
    case when not b.levels_ok then 'levels_unresolvable' end,
    case when b.levels_ok and b.status = 'closed' and b.exit_price is not null
      then 'exit_beyond_' || public.trade_exit_beyond_level(b.side, b.entry_price, b.exit_price, b.new_sl, b.new_tp) end,
    case when b.closed_at <= b.opened_at then 'closed_not_after_opened' end,
    case when b.opened_at > now() or b.closed_at > now() then 'future_date' end,
    case when b.status = 'closed' and b.lot_size is null then 'missing_lot_size' end,
    case when b.dup_n > 1 then 'duplicate' end,
    case when not (public.trade_price_in_band(b.symbol, b.entry_price) and public.trade_price_in_band(b.symbol, b.exit_price)
                and public.trade_price_in_band(b.symbol, b.new_sl) and public.trade_price_in_band(b.symbol, b.new_tp))
      then 'price_out_of_range' end
  ], null) as reasons
from base b;

create index on fix (id);

-- 3. Audit, then apply ------------------------------------------------------
insert into public.trade_audit_log (table_name, row_id, field, old_value, new_value, reason)
select 'signals', id, 'stop_loss', stop_loss::text, new_sl::text, 'sl_tp_swapped'
from fix where levels_ok and new_sl is distinct from stop_loss
union all
select 'signals', id, 'take_profit', take_profit::text, new_tp::text, 'sl_tp_swapped'
from fix where levels_ok and new_tp is distinct from take_profit
union all
select 'signals', id, 'close_trigger', close_trigger, new_trigger, 'close_reason_derived_from_prices'
from fix where new_trigger is distinct from close_trigger
union all
select 'signals', id, 'needs_review', 'false', 'true', array_to_string(reasons, ',')
from fix where cardinality(reasons) > 0;

update public.signals s
set stop_loss = case when f.levels_ok then f.new_sl else s.stop_loss end,
    take_profit = case when f.levels_ok then f.new_tp else s.take_profit end,
    close_trigger = f.new_trigger,
    needs_review = cardinality(f.reasons) > 0,
    review_reasons = case when cardinality(f.reasons) > 0 then f.reasons end
from fix f
where f.id = s.id
  and ((f.levels_ok and (f.new_sl is distinct from s.stop_loss or f.new_tp is distinct from s.take_profit))
    or f.new_trigger is distinct from s.close_trigger
    or cardinality(f.reasons) > 0);

-- 4. Copied positions: results already paid into follower balances are not
--    rewritten; inconsistencies with the source trade are flagged.
create temp table pfix on commit drop as
select sp.id,
  array_remove(array[
    case when sp.status = 'open' and x.status = 'closed' then 'open_on_closed_trade' end,
    case when sp.status = 'closed' and sp.exit_price is distinct from x.exit_price then 'exit_differs_from_trade' end,
    case when sp.status = 'closed'
      and abs(coalesce(sp.pnl, 1e9) - public.trade_position_pnl(x.side, sp.entry_price, sp.exit_price, sp.size)) > 0.01
      then 'pnl_mismatch' end,
    case when sp.closed_at <= sp.opened_at then 'closed_not_after_opened' end
  ], null) as reasons
from public.simulated_positions sp
join public.signals x on x.id = sp.signal_id;

insert into public.trade_audit_log (table_name, row_id, field, old_value, new_value, reason)
select 'simulated_positions', id, 'needs_review', 'false', 'true', array_to_string(reasons, ',')
from pfix where cardinality(reasons) > 0;

update public.simulated_positions sp
set needs_review = true, review_reasons = p.reasons
from pfix p
where p.id = sp.id and cardinality(p.reasons) > 0;

commit;

-- 5. Trade-derived aggregates. Win rate / ROI / drawdown / equity curve /
--    period performance / reliability are all computed from side+prices at
--    read time (provider_performance_mv, provider_period_stats, lib/*), so
--    only the materialized view needs a refresh.
refresh materialized view public.provider_performance_mv;
