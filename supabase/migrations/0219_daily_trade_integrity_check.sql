-- Daily lightweight trade-integrity check.
-- Rollback: supabase/rollback/0219_daily_trade_integrity_check.sql
--
-- Once a day, re-runs the trade_integrity_issues() rules (result direction,
-- S/L-T/P placement, close reason, times, values, copy vs source trade) on
-- trades opened or closed in the last 24 hours only, writes one row to
-- trade_integrity_reports ("ok", or "issues" with the details) and notifies
-- every admin when something is wrong. It never corrects anything.

-- Window support: p_since null = whole history (unchanged behaviour).
drop function if exists public.trade_integrity_issues();

create index if not exists signals_closed_at_idx on public.signals (closed_at);
create index if not exists signals_opened_at_idx on public.signals (opened_at);
create index if not exists signals_provider_opened_idx on public.signals (provider_id, opened_at);

create or replace function public.trade_integrity_issues(p_since timestamptz default null)
returns table (tbl text, row_id uuid, category text, detail text, flagged boolean)
language sql stable as $$
  with s as (
    select x.*, public.trade_dir(x.side) as dir,
      (x.exit_price - x.entry_price) * public.trade_dir(x.side) as d,
      (public.trade_levels(x.side, x.entry_price, x.stop_loss, x.take_profit)).ok as levels_ok
    from public.signals x
    where p_since is null or x.opened_at >= p_since or x.closed_at >= p_since
  ),
  p as (
    select sp.*, x.side as sig_side, x.status as sig_status, x.exit_price as sig_exit
    from public.simulated_positions sp
    join public.signals x on x.id = sp.signal_id
    where p_since is null or sp.opened_at >= p_since or sp.closed_at >= p_since
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
    -- times (wall clock: a long-running report transaction must not see
    -- trades written meanwhile as future-dated)
    union all select 'signals', id, 'times', 'closed_not_after_opened', needs_review from s where closed_at <= opened_at
    union all select 'signals', id, 'times', 'future_date', needs_review from s
      where opened_at > clock_timestamp() or closed_at > clock_timestamp()
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
    union all select 'signals', s.id, 'values', 'duplicate', s.needs_review from s
      where exists (
        select 1 from public.signals o
        where o.provider_id = s.provider_id and o.opened_at = s.opened_at and o.id <> s.id
          and o.symbol = s.symbol and o.side = s.side and o.entry_price = s.entry_price)
    -- price sanity
    union all select 'signals', id, 'price_range', 'out_of_band', needs_review from s
      where not (public.trade_price_in_band(symbol, entry_price) and public.trade_price_in_band(symbol, exit_price)
             and public.trade_price_in_band(symbol, stop_loss) and public.trade_price_in_band(symbol, take_profit))
  ),
  pos as (
    select 'simulated_positions', id, 'direction_pnl', 'pnl_mismatch', needs_review from p
      where status = 'closed'
        and abs(coalesce(pnl, 1e9) - public.trade_position_pnl(sig_side, entry_price, exit_price, size)) > 0.01
    union all select 'simulated_positions', id, 'direction_pnl', 'exit_differs_from_trade', needs_review from p
      where status = 'closed' and exit_price is distinct from sig_exit
    union all select 'simulated_positions', id, 'direction_pnl', 'open_on_closed_trade', needs_review from p
      where status = 'open' and sig_status = 'closed'
    union all select 'simulated_positions', id, 'times', 'closed_not_after_opened', needs_review from p
      where closed_at <= opened_at
    union all select 'simulated_positions', id, 'times', 'future_date', needs_review from p
      where opened_at > clock_timestamp() or closed_at > clock_timestamp()
    union all select 'simulated_positions', id, 'values', 'non_positive', needs_review from p
      where entry_price <= 0 or exit_price <= 0 or size <= 0
    union all select 'simulated_positions', id, 'values', 'missing_required', needs_review from p
      where status = 'closed' and (exit_price is null or pnl is null or closed_at is null)
  )
  select * from sig union all select * from pos
$$;

revoke all on function public.trade_integrity_issues(timestamptz) from public, anon, authenticated;

-- One row per run. Admin-read only.
create table if not exists public.trade_integrity_reports (
  id bigserial primary key,
  run_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  signals_checked int not null,
  positions_checked int not null,
  issue_count int not null,
  status text not null check (status in ('ok', 'issues')),
  summary jsonb not null default '{}'::jsonb,   -- {"<category>:<detail>": count}
  issues jsonb not null default '[]'::jsonb     -- first 200 {tbl,row_id,category,detail}
);
create index if not exists trade_integrity_reports_run_at_idx on public.trade_integrity_reports (run_at desc);
alter table public.trade_integrity_reports enable row level security;
revoke all on public.trade_integrity_reports from anon, authenticated;
grant select on public.trade_integrity_reports to authenticated;
drop policy if exists trade_integrity_reports_select_admin on public.trade_integrity_reports;
create policy trade_integrity_reports_select_admin on public.trade_integrity_reports
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- The check itself. Reports only; never modifies a trade.
create or replace function public.run_trade_integrity_check(p_hours int default 24)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz := clock_timestamp();
  v_start timestamptz := v_end - make_interval(hours => p_hours);
  v_signals int;
  v_positions int;
  v_count int;
  v_summary jsonb;
  v_issues jsonb;
  v_report_id bigint;
begin
  set local statement_timeout = 0;

  drop table if exists _tic;
  create temp table _tic on commit drop as
  select * from public.trade_integrity_issues(v_start) where not flagged;

  select count(*) into v_signals from public.signals where opened_at >= v_start or closed_at >= v_start;
  select count(*) into v_positions from public.simulated_positions where opened_at >= v_start or closed_at >= v_start;
  select count(distinct row_id) into v_count from _tic;
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into v_summary
    from (select category || ':' || detail as k, count(*) as n from _tic group by 1) x;
  select coalesce(jsonb_agg(jsonb_build_object('tbl', tbl, 'row_id', row_id, 'category', category, 'detail', detail)), '[]'::jsonb)
    into v_issues
    from (select * from _tic order by tbl, category, detail limit 200) x;

  insert into public.trade_integrity_reports
    (window_start, window_end, signals_checked, positions_checked, issue_count, status, summary, issues)
  values (v_start, v_end, v_signals, v_positions, v_count,
          case when v_count = 0 then 'ok' else 'issues' end, v_summary, v_issues)
  returning id into v_report_id;

  if v_count > 0 then
    insert into public.notifications (user_id, type, title, body, data)
    select p.id, 'trade_integrity_alert',
      'تنبيه سلامة الصفقات',
      'الفحص اليومي وجد ' || v_count || ' صفقة بها أخطاء.',
      jsonb_build_object('issues', v_count, 'reportId', v_report_id)
    from public.profiles p where p.is_admin;
  end if;

  return v_report_id;
end;
$$;

revoke all on function public.run_trade_integrity_check(int) from public, anon, authenticated;

-- Daily at 03:40 UTC (after the 03:11 leader lifecycle job).
select cron.unschedule(jobid) from cron.job where jobname = 'trade-integrity-daily';
select cron.schedule('trade-integrity-daily', '40 3 * * *', 'select public.run_trade_integrity_check(24)');
