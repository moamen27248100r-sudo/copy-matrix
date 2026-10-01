-- Trade integrity, part 1: shared rules + audit schema (no data changes).
--
-- Source of truth for every trade is side + entry_price + exit_price.
-- Everything else (result sign, %, Δ points, close reason, which stored
-- level is the stop and which the target) is derived from those three by
-- the helpers below, which the backfill (0216), the guard trigger (0217),
-- the live engine and the integrity report all share.

alter table public.signals
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reasons text[];
alter table public.simulated_positions
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reasons text[];

create index if not exists signals_needs_review_idx on public.signals (id) where needs_review;

-- Every correction to a trade row, field by field. Admin-read only.
create table if not exists public.trade_audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id uuid not null,
  field text not null,
  old_value text,
  new_value text,
  reason text not null,
  changed_at timestamptz not null default now()
);
create index if not exists trade_audit_log_row_idx on public.trade_audit_log (row_id);
alter table public.trade_audit_log enable row level security;
revoke all on public.trade_audit_log from anon, authenticated;
grant select on public.trade_audit_log to authenticated;
drop policy if exists trade_audit_log_select_admin on public.trade_audit_log;
create policy trade_audit_log_select_admin on public.trade_audit_log
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- +1 for buy, -1 for sell.
create or replace function public.trade_dir(p_side text)
returns int language sql immutable as $$
  select case when p_side = 'sell' then -1 else 1 end
$$;

-- Plausible price band per symbol (covers 2019-2026 history with margin).
-- Unknown symbols have no band (null, null).
create or replace function public.trade_price_band(p_symbol text, out lo numeric, out hi numeric)
language plpgsql immutable as $$
begin
  case p_symbol
    when 'XAUUSD' then lo := 1000; hi := 8000;
    when 'BTCUSDT' then lo := 3000; hi := 300000;
    when 'ETHUSDT' then lo := 80; hi := 15000;
    when 'SOLUSDT' then lo := 1; hi := 1000;
    when 'BNBUSDT' then lo := 5; hi := 3000;
    when 'XRPUSDT' then lo := 0.1; hi := 10;
    when 'EURUSD' then lo := 0.7; hi := 1.7;
    when 'GBPUSD' then lo := 0.9; hi := 2.0;
    when 'USDJPY' then lo := 70; hi := 250;
    when 'US30' then lo := 15000; hi := 70000;
    else null;
  end case;
end;
$$;

create or replace function public.trade_price_in_band(p_symbol text, p_price numeric)
returns boolean language sql immutable as $$
  select p_price is null or b.lo is null or (p_price between b.lo and b.hi)
  from public.trade_price_band(p_symbol) b
$$;

-- Classifies the two stored levels by where they sit relative to entry: a
-- buy's stop is below entry and its target above; a sell is the reverse
-- (same rule as resolveLevels() in src/lib/pip-specs.ts). ok = false when
-- the pair can't be resolved (non-positive, equal to entry, or both on the
-- same side).
create or replace function public.trade_levels(
  p_side text, p_entry numeric, p_stop_loss numeric, p_take_profit numeric,
  out sl numeric, out tp numeric, out ok boolean)
language plpgsql immutable as $$
declare
  v_dir int := public.trade_dir(p_side);
  v numeric;
begin
  ok := true;
  foreach v in array array[p_stop_loss, p_take_profit] loop
    continue when v is null;
    if v <= 0 or v = p_entry then
      ok := false;
    elsif (v - p_entry) * v_dir < 0 then
      if sl is not null then ok := false; else sl := v; end if;
    else
      if tp is not null then ok := false; else tp := v; end if;
    end if;
  end loop;
  if not ok then
    sl := p_stop_loss;
    tp := p_take_profit;
  end if;
end;
$$;

-- Tolerance for "the exit is at this level": 5% of the level's distance
-- from entry, floored at 0.01% of entry.
create or replace function public.trade_level_tol(p_entry numeric, p_level numeric)
returns numeric language sql immutable as $$
  select greatest(abs(p_level - p_entry) * 0.05, p_entry * 0.0001)
$$;

-- Close reason derived from the prices. p_requested is the reason the
-- caller asked for; it is only kept where the prices allow it.
create or replace function public.trade_close_trigger(
  p_side text, p_entry numeric, p_exit numeric, p_stop_loss numeric, p_take_profit numeric, p_requested text)
returns text language plpgsql immutable as $$
declare
  v_d numeric := (p_exit - p_entry) * public.trade_dir(p_side);
begin
  if p_take_profit is not null and v_d > 0
     and abs(p_exit - p_take_profit) <= public.trade_level_tol(p_entry, p_take_profit) then
    return 'tp';
  end if;
  if p_stop_loss is not null and v_d < 0
     and abs(p_exit - p_stop_loss) <= public.trade_level_tol(p_entry, p_stop_loss) then
    return 'sl';
  end if;
  if p_requested = 'margin_call' and v_d < 0 then
    return 'margin_call';
  end if;
  if abs(v_d) <= p_entry * 0.0002 then
    return 'breakeven';
  end if;
  if p_requested = 'timeout' then
    return 'timeout';
  end if;
  return 'manual';
end;
$$;

-- 'sl' / 'tp' when the exit went past that level (a stop or target that
-- would have filled first), else null.
create or replace function public.trade_exit_beyond_level(
  p_side text, p_entry numeric, p_exit numeric, p_stop_loss numeric, p_take_profit numeric)
returns text language sql immutable as $$
  select case
    when p_stop_loss is not null and (p_exit - p_entry) * public.trade_dir(p_side) < 0
      and abs(p_exit - p_entry) > abs(p_stop_loss - p_entry) + public.trade_level_tol(p_entry, p_stop_loss) then 'sl'
    when p_take_profit is not null and (p_exit - p_entry) * public.trade_dir(p_side) > 0
      and abs(p_exit - p_entry) > abs(p_take_profit - p_entry) + public.trade_level_tol(p_entry, p_take_profit) then 'tp'
  end
$$;

-- Follower result for a copied position, rounded to cents.
create or replace function public.trade_position_pnl(p_side text, p_entry numeric, p_exit numeric, p_size numeric)
returns numeric language sql immutable as $$
  select round(((p_exit - p_entry) / p_entry * p_size * public.trade_dir(p_side))::numeric, 2)
$$;

-- The integrity report: one row per (trade, problem). Flagged rows
-- (needs_review) are included but marked, so a clean bill of health is
-- "zero rows where not flagged".
create or replace function public.trade_integrity_issues()
returns table (tbl text, row_id uuid, category text, detail text, flagged boolean)
language sql stable as $$
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
    union all select 'signals', id, 'times', 'future_date', needs_review from s where opened_at > now() or closed_at > now()
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
      from public.simulated_positions sp where sp.opened_at > now() or sp.closed_at > now()
    union all select 'simulated_positions', sp.id, 'values', 'non_positive', sp.needs_review
      from public.simulated_positions sp where sp.entry_price <= 0 or sp.exit_price <= 0 or sp.size <= 0
    union all select 'simulated_positions', sp.id, 'values', 'missing_required', sp.needs_review
      from public.simulated_positions sp
      where sp.status = 'closed' and (sp.exit_price is null or sp.pnl is null or sp.closed_at is null)
  )
  select * from sig union all select * from pos
$$;

revoke all on function public.trade_integrity_issues() from public, anon, authenticated;
