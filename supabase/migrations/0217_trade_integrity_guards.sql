-- Trade integrity, part 3: guards so no new trade can be written wrong.
-- Rollback: supabase/rollback/0217_trade_integrity_guards.sql
--
--   * signals_integrity_guard / simulated_positions_integrity_guard
--     (BEFORE INSERT OR UPDATE): correct what is derivable (swapped S/L-T/P,
--     close reason, copied-position result) and reject what isn't (side
--     change, level on the wrong side, non-positive / out-of-range price,
--     future or reversed times, exit past a stop or target).
--   * CHECK constraints backing the same rules (needs_review rows exempt
--     from the rules they were flagged for).
--   * run_market_simulation: no longer flips a trade's side at close,
--     clamps timed and margin-call closes at the stop/target, result sign
--     follows the prices.
--   * lead_trader_open_order validates levels (LT006);
--     lead_trader_close_order fills at a crossed stop/target.
--   * close_simulated_positions credits the same cent-rounded result the
--     guard stores.
--
-- needs_review can only be set inside a session that runs
-- `set local app.trade_review_flagging = 'on'` (admin backfills).

begin;
set local statement_timeout = 0;
-- Block engine writes for the duration so constraint validation sees a
-- settled table.
lock table public.signals, public.simulated_positions in share row exclusive mode;

create or replace function public.signals_integrity_guard()
returns trigger language plpgsql as $$
declare
  v_flagging boolean := coalesce(current_setting('app.trade_review_flagging', true), '') = 'on';
  v_levels record;
  v_beyond text;
begin
  if tg_op = 'INSERT' then
    if not v_flagging then
      new.needs_review := false;
      new.review_reasons := null;
    end if;
  else
    if new.side is distinct from old.side then
      raise exception 'trade side cannot change after opening' using errcode = '23514';
    end if;
    if new.needs_review and not old.needs_review and not v_flagging then
      new.needs_review := false;
      new.review_reasons := null;
    end if;
  end if;

  if new.needs_review then
    return new;
  end if;

  if new.side not in ('buy', 'sell') then
    raise exception 'invalid side %', new.side using errcode = '23514';
  end if;
  if new.entry_price is null or new.entry_price <= 0 or new.exit_price <= 0 or new.lot_size <= 0 then
    raise exception 'trade prices and lot size must be positive' using errcode = '23514';
  end if;

  select * into v_levels from public.trade_levels(new.side, new.entry_price, new.stop_loss, new.take_profit);
  if not v_levels.ok then
    raise exception 'invalid stop loss / take profit for a % at %', new.side, new.entry_price using errcode = '23514';
  end if;
  new.stop_loss := v_levels.sl;
  new.take_profit := v_levels.tp;

  if not (public.trade_price_in_band(new.symbol, new.entry_price) and public.trade_price_in_band(new.symbol, new.exit_price)
      and public.trade_price_in_band(new.symbol, new.stop_loss) and public.trade_price_in_band(new.symbol, new.take_profit)) then
    raise exception 'price out of the plausible range for %', new.symbol using errcode = '23514';
  end if;

  if new.opened_at > now() + interval '1 minute' then
    raise exception 'opened_at is in the future' using errcode = '23514';
  end if;

  if new.status = 'closed' then
    if new.exit_price is null then
      raise exception 'closed trade needs an exit price' using errcode = '23514';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
    if new.closed_at > now() + interval '1 minute' then
      raise exception 'closed_at is in the future' using errcode = '23514';
    end if;
    if new.closed_at <= new.opened_at then
      raise exception 'closed_at must be after opened_at' using errcode = '23514';
    end if;
    v_beyond := public.trade_exit_beyond_level(new.side, new.entry_price, new.exit_price, new.stop_loss, new.take_profit);
    if v_beyond is not null then
      raise exception 'exit price % is past the % level', new.exit_price, v_beyond using errcode = '23514';
    end if;
    new.close_trigger := public.trade_close_trigger(
      new.side, new.entry_price, new.exit_price, new.stop_loss, new.take_profit, new.close_trigger);
  else
    if new.exit_price is not null or new.closed_at is not null then
      raise exception 'open trade cannot have an exit price or close time' using errcode = '23514';
    end if;
    new.close_trigger := null;
  end if;

  return new;
end;
$$;

create or replace function public.simulated_positions_integrity_guard()
returns trigger language plpgsql as $$
declare
  v_flagging boolean := coalesce(current_setting('app.trade_review_flagging', true), '') = 'on';
  v_side text;
begin
  if tg_op = 'INSERT' then
    if not v_flagging then
      new.needs_review := false;
      new.review_reasons := null;
    end if;
  elsif new.needs_review and not old.needs_review and not v_flagging then
    new.needs_review := false;
    new.review_reasons := null;
  end if;

  if new.needs_review then
    return new;
  end if;

  if new.entry_price is null or new.entry_price <= 0 or new.size is null or new.size <= 0 or new.exit_price <= 0 then
    raise exception 'position prices and size must be positive' using errcode = '23514';
  end if;
  if new.opened_at > now() + interval '1 minute' then
    raise exception 'opened_at is in the future' using errcode = '23514';
  end if;

  if new.status = 'closed' then
    if new.exit_price is null then
      raise exception 'closed position needs an exit price' using errcode = '23514';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
    if new.closed_at > now() + interval '1 minute' or new.closed_at <= new.opened_at then
      raise exception 'position close time must be after open and not in the future' using errcode = '23514';
    end if;
    select side into v_side from public.signals where id = new.signal_id;
    new.pnl := public.trade_position_pnl(v_side, new.entry_price, new.exit_price, new.size);
  else
    if new.exit_price is not null or new.closed_at is not null then
      raise exception 'open position cannot have an exit price or close time' using errcode = '23514';
    end if;
    new.pnl := null;
  end if;

  return new;
end;
$$;

-- Catch-up: trades the engine wrote between 0216 and now, with the same
-- rules as 0216 (correct what's derivable, flag the rest, audit both).
set local app.trade_review_flagging = 'on';

create temp table catchup on commit drop as
with bad as (
  select distinct row_id from public.trade_integrity_issues() where tbl = 'signals' and not flagged
),
base as (
  select s.id, s.side, s.symbol, s.status, s.entry_price, s.exit_price, s.lot_size,
    s.stop_loss, s.take_profit, s.close_trigger, s.opened_at, s.closed_at,
    l.sl as new_sl, l.tp as new_tp, l.ok as levels_ok
  from public.signals s
  join bad on bad.row_id = s.id
  cross join lateral public.trade_levels(s.side, s.entry_price, s.stop_loss, s.take_profit) l
)
select b.*,
  case
    when b.status <> 'closed' or b.exit_price is null then b.close_trigger
    when not b.levels_ok then coalesce(b.close_trigger,
      public.trade_close_trigger(b.side, b.entry_price, b.exit_price, null, null, null))
    else public.trade_close_trigger(b.side, b.entry_price, b.exit_price, b.new_sl, b.new_tp,
      case when b.close_trigger in ('tp', 'sl', 'breakeven') then 'timeout' else b.close_trigger end)
  end as new_trigger,
  array_remove(array[
    case when not b.levels_ok then 'levels_unresolvable' end,
    case when b.levels_ok and b.status = 'closed' and b.exit_price is not null
      then 'exit_beyond_' || public.trade_exit_beyond_level(b.side, b.entry_price, b.exit_price, b.new_sl, b.new_tp) end,
    case when b.closed_at <= b.opened_at then 'closed_not_after_opened' end,
    case when b.opened_at > now() or b.closed_at > now() then 'future_date' end,
    case when b.status = 'closed' and b.lot_size is null then 'missing_lot_size' end,
    case when not (public.trade_price_in_band(b.symbol, b.entry_price) and public.trade_price_in_band(b.symbol, b.exit_price)
                and public.trade_price_in_band(b.symbol, b.new_sl) and public.trade_price_in_band(b.symbol, b.new_tp))
      then 'price_out_of_range' end
  ], null) as reasons
from base b;

insert into public.trade_audit_log (table_name, row_id, field, old_value, new_value, reason)
select 'signals', id, 'stop_loss', stop_loss::text, new_sl::text, 'sl_tp_swapped'
from catchup where levels_ok and new_sl is distinct from stop_loss
union all
select 'signals', id, 'take_profit', take_profit::text, new_tp::text, 'sl_tp_swapped'
from catchup where levels_ok and new_tp is distinct from take_profit
union all
select 'signals', id, 'close_trigger', close_trigger, new_trigger, 'close_reason_derived_from_prices'
from catchup where new_trigger is distinct from close_trigger
union all
select 'signals', id, 'needs_review', 'false', 'true', array_to_string(reasons, ',')
from catchup where cardinality(reasons) > 0;

update public.signals s
set stop_loss = case when c.levels_ok then c.new_sl else s.stop_loss end,
    take_profit = case when c.levels_ok then c.new_tp else s.take_profit end,
    close_trigger = c.new_trigger,
    needs_review = cardinality(c.reasons) > 0,
    review_reasons = case when cardinality(c.reasons) > 0 then c.reasons end
from catchup c
where c.id = s.id;

create temp table pcatchup on commit drop as
select row_id as id, array_agg(distinct detail) as reasons
from public.trade_integrity_issues()
where tbl = 'simulated_positions' and not flagged
group by row_id;

insert into public.trade_audit_log (table_name, row_id, field, old_value, new_value, reason)
select 'simulated_positions', id, 'needs_review', 'false', 'true', array_to_string(reasons, ',')
from pcatchup;

update public.simulated_positions sp
set needs_review = true, review_reasons = p.reasons
from pcatchup p
where p.id = sp.id;

-- Guards on.
drop trigger if exists signals_integrity_guard on public.signals;
create trigger signals_integrity_guard
  before insert or update on public.signals
  for each row execute function public.signals_integrity_guard();

drop trigger if exists simulated_positions_integrity_guard on public.simulated_positions;
create trigger simulated_positions_integrity_guard
  before insert or update on public.simulated_positions
  for each row execute function public.simulated_positions_integrity_guard();

alter table public.signals
  add constraint signals_exit_price_positive check (exit_price is null or exit_price > 0),
  add constraint signals_lot_size_positive check (lot_size is null or lot_size > 0),
  add constraint signals_levels_valid check (needs_review or (
    (stop_loss is null or (stop_loss > 0 and (stop_loss - entry_price) * public.trade_dir(side) < 0))
    and (take_profit is null or (take_profit > 0 and (take_profit - entry_price) * public.trade_dir(side) > 0)))),
  add constraint signals_status_fields check (
    (status = 'open' and exit_price is null and closed_at is null and close_trigger is null)
    or (status = 'closed' and exit_price is not null and closed_at is not null and close_trigger is not null)),
  add constraint signals_closed_after_opened check (needs_review or closed_at is null or closed_at > opened_at),
  add constraint signals_close_trigger_valid check (
    close_trigger is null or close_trigger in ('tp', 'sl', 'timeout', 'breakeven', 'margin_call', 'manual')),
  add constraint signals_close_trigger_direction check (needs_review or close_trigger is null
    or (close_trigger = 'tp' and (exit_price - entry_price) * public.trade_dir(side) > 0)
    or (close_trigger in ('sl', 'margin_call') and (exit_price - entry_price) * public.trade_dir(side) < 0)
    or close_trigger in ('timeout', 'manual', 'breakeven'));

alter table public.simulated_positions
  add constraint simulated_positions_size_positive check (size > 0),
  add constraint simulated_positions_entry_positive check (entry_price > 0),
  add constraint simulated_positions_exit_positive check (exit_price is null or exit_price > 0),
  add constraint simulated_positions_status_fields check (
    (status = 'open' and exit_price is null and closed_at is null)
    or (status = 'closed' and exit_price is not null and closed_at is not null and pnl is not null)),
  add constraint simulated_positions_closed_after_opened check (needs_review or closed_at is null or closed_at > opened_at);

-- Lead trader RPCs.
CREATE OR REPLACE FUNCTION public.lead_trader_open_order(p_symbol text, p_side text, p_size numeric, p_stop_loss numeric DEFAULT NULL::numeric, p_take_profit numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_provider_id uuid;
  v_price numeric;
  v_signal_id uuid;
BEGIN
  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'invalid side' USING ERRCODE = 'LT001';
  END IF;
  IF p_size IS NULL OR p_size <= 0 THEN
    RAISE EXCEPTION 'invalid size' USING ERRCODE = 'LT002';
  END IF;

  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT price INTO v_price FROM public.market_prices WHERE symbol = p_symbol;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'unknown symbol' USING ERRCODE = 'LT004';
  END IF;

  -- A buy's stop sits below the fill and its target above; a sell is the
  -- reverse.
  IF (p_stop_loss IS NOT NULL AND (p_stop_loss <= 0 OR (p_stop_loss - v_price) * public.trade_dir(p_side) >= 0))
     OR (p_take_profit IS NOT NULL AND (p_take_profit <= 0 OR (p_take_profit - v_price) * public.trade_dir(p_side) <= 0)) THEN
    RAISE EXCEPTION 'invalid stop loss / take profit' USING ERRCODE = 'LT006';
  END IF;

  INSERT INTO public.signals (provider_id, symbol, side, entry_price, stop_loss, take_profit, status, opened_at, created_by_admin, lot_size)
  VALUES (v_provider_id, p_symbol, p_side, v_price, p_stop_loss, p_take_profit, 'open', now(), false, p_size)
  RETURNING id INTO v_signal_id;

  RETURN v_signal_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lead_trader_close_order(p_signal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_signal record;
  v_price numeric;
BEGIN
  SELECT s.symbol, s.side, s.entry_price, s.stop_loss, s.take_profit INTO v_signal
  FROM public.signals s
  JOIN public.providers pr ON pr.id = s.provider_id
  WHERE s.id = p_signal_id AND pr.user_id = auth.uid() AND s.status = 'open'
  FOR UPDATE OF s;

  IF v_signal.symbol IS NULL THEN
    RAISE EXCEPTION 'order not found or already closed' USING ERRCODE = 'LT005';
  END IF;

  SELECT price INTO v_price FROM public.market_prices WHERE symbol = v_signal.symbol;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'no live price' USING ERRCODE = 'LT004';
  END IF;

  -- If the market already moved past the stop or target, that order
  -- filled first, at its level.
  IF v_signal.stop_loss IS NOT NULL AND (v_price - v_signal.stop_loss) * public.trade_dir(v_signal.side) <= 0 THEN
    v_price := v_signal.stop_loss;
  ELSIF v_signal.take_profit IS NOT NULL AND (v_price - v_signal.take_profit) * public.trade_dir(v_signal.side) >= 0 THEN
    v_price := v_signal.take_profit;
  END IF;

  UPDATE public.signals
  SET status = 'closed', exit_price = v_price, closed_at = now(), close_trigger = 'manual'
  WHERE id = p_signal_id;
END;
$function$;

-- Copied-position close: cent-rounded result.
CREATE OR REPLACE FUNCTION public.close_simulated_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_position record;
  v_pnl numeric;
  v_follower_balance numeric;
  v_sub record;
  v_cumulative_pnl numeric;
  v_provider_name text;
  v_pct numeric;
  v_follower_id uuid;
begin
  if new.status = 'closed' and old.status = 'open' then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = new.provider_id;

    for v_position in
      select * from public.simulated_positions
      where signal_id = new.id and status = 'open'
    loop
      -- Same cent-rounded result simulated_positions_integrity_guard stores,
      -- so the balance credit always equals the recorded pnl.
      v_pnl := public.trade_position_pnl(new.side, v_position.entry_price, new.exit_price, v_position.size);

      update public.simulated_positions
      set exit_price = new.exit_price,
          status = 'closed',
          closed_at = now(),
          pnl = v_pnl
      where id = v_position.id;

      update public.profiles
      set balance = balance + v_pnl
      where id = v_position.follower_id
      returning balance into v_follower_balance;

      insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
      values (
        v_position.follower_id, 'pnl', v_pnl, v_follower_balance,
        'نتيجة صفقة منسوخة: ' || new.symbol
      );

      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_position.follower_id,
        'copy_closed',
        'صفقة منسوخة من ' || coalesce(v_provider_name, 'متداول'),
        'أُغلقت صفقة ' || new.symbol || ' بنتيجة ' ||
          (case when v_pnl >= 0 then '+' else '' end) || round(v_pnl, 2) || '$',
        jsonb_build_object(
          'providerName', coalesce(v_provider_name, 'متداول'),
          'symbol', new.symbol,
          'amount', round(abs(v_pnl), 2),
          'positive', v_pnl >= 0
        )
      );

      select id, allocated_amount, max_drawdown_pct, is_active into v_sub
      from public.subscriptions where id = v_position.subscription_id;

      if v_sub.is_active then
        select coalesce(sum(pnl), 0) into v_cumulative_pnl
        from public.simulated_positions
        where subscription_id = v_sub.id and status = 'closed';

        if v_cumulative_pnl <= -(v_sub.allocated_amount * v_sub.max_drawdown_pct / 100) then
          update public.subscriptions set is_active = false where id = v_sub.id;

          insert into public.notifications (user_id, type, title, body, data)
          values (
            v_position.follower_id,
            'auto_stop_copy',
            'تم إيقاف النسخ تلقائيًا',
            'تم إيقاف متابعة أحد المتداولين تلقائيًا بعد تجاوز حد الخسارة المسموح به (' ||
              v_sub.max_drawdown_pct || '%). يمكنك متابعته مجددًا في أي وقت من صفحة اكتشاف المتداولين.',
            jsonb_build_object('maxDrawdownPct', v_sub.max_drawdown_pct)
          );
        end if;
      end if;
    end loop;

    if exists (select 1 from public.follows where provider_id = new.provider_id) then
      v_pct := round(
        (((new.exit_price - new.entry_price) / new.entry_price)
          * (case when new.side = 'sell' then -1 else 1 end) * 100)::numeric,
        2
      );

      for v_follower_id in
        select follower_id from public.follows where provider_id = new.provider_id
      loop
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_follower_id,
          'followed_trade_closed',
          'صفقة جديدة من متداول تتابعه',
          coalesce(v_provider_name, 'متداول') || ' أغلق صفقة ' || new.symbol || ' بنتيجة ' ||
            (case when v_pct >= 0 then '+' else '' end) || v_pct || '%',
          jsonb_build_object(
            'providerName', coalesce(v_provider_name, 'متداول'),
            'symbol', new.symbol,
            'pct', abs(v_pct),
            'positive', v_pct >= 0
          )
        );
      end loop;
    end if;
  end if;
  return new;
end;
$function$
;

-- Live engine.
CREATE OR REPLACE FUNCTION public.run_market_simulation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dow int;
  v_month_day text;
  v_market_closed boolean;
  v_current_hour int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_crypto_symbols text[] := array['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
  v_forex_symbols text[] := array['EURUSD','GBPUSD','USDJPY'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_signal record;
  v_provider record;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_anchor numeric;
  v_move numeric;
  v_is_win boolean;
  v_archetype text;
  v_notional numeric := 2000;
  v_pnl numeric;
  v_withdrawal_bump numeric;
  v_target_ratio numeric;
  v_projected_profit numeric;
  v_profit_ceiling numeric;
  v_follower_delta int;
  v_follower_cap int;
  v_roll numeric;
  v_base_loss numeric;
  v_pip_size numeric;
  v_pip_value_per_lot numeric;
  v_exit_price numeric;
  v_pips numeric;
  v_risk_fraction numeric;
  v_lot_size numeric;
  v_commission numeric;
  v_swap numeric;
  v_days_held numeric;
  v_in_session boolean;
  v_target_pips numeric;
  v_target_distance numeric;
  v_lagged_entry numeric;
  v_skill_rr numeric;
  v_scalp_pip_cap numeric;
  v_window_minutes int;
  v_micro numeric;
  v_open_prob numeric;
  v_margin_call boolean;
  v_new_margin_count int;
  v_recover_prob numeric;
  v_current_price numeric;
  v_hit_tp boolean;
  v_hit_sl boolean;
  v_close_trigger text;
  v_tp_pips numeric;
  v_sl_pips numeric;
  v_bucket text;
  v_has_real_follower boolean;
  v_provider_open_count int;
  v_density_floor int;
begin
  v_dow := extract(dow from now());
  v_month_day := to_char(now(), 'MM-DD');
  v_current_hour := extract(hour from now())::int;

  v_market_closed := (
    v_dow = 6
    or (v_dow = 0 and v_current_hour < 22)
    or (v_dow = 5 and v_current_hour >= 22)
    or v_month_day in ('01-01', '12-25')
  );

  for v_signal in
    select s.id, s.provider_id, s.side, s.entry_price, s.symbol, s.opened_at, s.predetermined_win,
      s.take_profit, s.stop_loss, s.created_by_admin,
      coalesce(p.skill, 0.55) as skill, p.display_name, p.country, p.min_copy_amount,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      coalesce(p.trading_style, 'moderate') as trading_style,
      p.rr_ratio, p.account_capital,
      coalesce(p.total_profit, 0) as total_profit, coalesce(p.total_withdrawals, 0) as total_withdrawals,
      (select mp.price from public.market_prices mp where mp.symbol = s.symbol) as live_price
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and coalesce(s.is_margin_call, false) = false
      and (
        s.opened_at < now() - (
          case
            when p.trading_style = 'scalper'
              then (floor(random() * 25 + 2) || ' minutes')::interval
            when p.risk_archetype = 'high_risk' and p.display_name not in ('أنس ريان', 'يوسف علي')
              then (floor(random() * 7200 + 2880) || ' minutes')::interval
            when p.trading_style = 'sporadic'
              then (floor(random() * 18000 + 1440) || ' minutes')::interval
            when p.trading_style in ('moderate', 'session_trader')
              then (floor(random() * 420 + 30) || ' minutes')::interval
            else (floor(random() * 2640 + 240) || ' minutes')::interval
          end
        )
        or (
          (s.take_profit is not null or s.stop_loss is not null)
          and exists (
            select 1 from public.market_prices mp
            where mp.symbol = s.symbol
              and (
                (s.side = 'buy' and (
                  (s.take_profit is not null and mp.price >= s.take_profit)
                  or (s.stop_loss is not null and mp.price <= s.stop_loss)
                ))
                or (s.side = 'sell' and (
                  (s.take_profit is not null and mp.price <= s.take_profit)
                  or (s.stop_loss is not null and mp.price >= s.stop_loss)
                ))
              )
          )
        )
        -- Absolute safety net: nothing stays open more than 30 days
        -- regardless of style, TP or SL -- prevents a processing backlog
        -- from ever again producing a multi-month-old "scalper" trade.
        or s.opened_at < now() - interval '30 days'
      )
      and (not v_market_closed or s.symbol = any(v_crypto_symbols))
    order by s.opened_at asc
    limit 40
  loop
    v_archetype := case when v_signal.display_name in ('أنس ريان', 'يوسف علي') then 'flagship' else v_signal.risk_archetype end;
    v_current_price := v_signal.live_price;
    v_hit_tp := false;
    v_hit_sl := false;

    if v_current_price is not null then
      if v_signal.take_profit is not null then
        if v_signal.side = 'buy' then
          v_hit_tp := v_current_price >= v_signal.take_profit;
        else
          v_hit_tp := v_current_price <= v_signal.take_profit;
        end if;
      end if;
      if v_signal.stop_loss is not null then
        if v_signal.side = 'buy' then
          v_hit_sl := v_current_price <= v_signal.stop_loss;
        else
          v_hit_sl := v_current_price >= v_signal.stop_loss;
        end if;
      end if;
    end if;

    if v_hit_sl then
      v_close_trigger := 'sl';
      v_is_win := false;
      v_side := v_signal.side;
      v_exit_price := v_signal.stop_loss;
    elsif v_hit_tp then
      v_close_trigger := 'tp';
      v_is_win := true;
      v_side := v_signal.side;
      v_exit_price := v_signal.take_profit;
    else
      v_is_win := coalesce(v_signal.predetermined_win, random() < v_signal.skill);
      v_side := v_signal.side;

      v_close_trigger := 'timeout';
      v_skill_rr := greatest(0.6, least(5.0, 3.0 + (coalesce(v_signal.skill, 0.55) - 0.55) * 6.667));

      case v_archetype
        when 'flagship' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'stable' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'good_rr' then
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * coalesce(v_signal.rr_ratio, 2.5))) else v_base_loss end;
        when 'high_risk' then
          v_base_loss := 0.10 + random() * 0.15;
          v_move := case when v_is_win then greatest(0.05, least(0.15, v_base_loss * v_skill_rr)) else v_base_loss end;
        when 'struggling' then
          v_move := case when v_is_win then 0.010 + random() * 0.035 else 0.008 + random() * 0.027 end;
        else
          v_base_loss := 0.003 + random() * 0.015;
          v_move := case when v_is_win then greatest(0.004, least(0.025, v_base_loss * v_skill_rr)) else v_base_loss end;
      end case;

      -- The side is fixed at open (its S/L and T/P were placed for it);
      -- it is never flipped at close.
      v_exit_price := round(
        case
          when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
            then v_signal.entry_price * (1 + v_move)
          else v_signal.entry_price * (1 - v_move)
        end,
        4
      );

      -- A timed close can't run past a stop or target: that order would
      -- have filled first, at its level.
      if v_signal.stop_loss is not null
         and (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) < 0
         and abs(v_exit_price - v_signal.entry_price) >= abs(v_signal.stop_loss - v_signal.entry_price) then
        v_exit_price := v_signal.stop_loss;
        v_close_trigger := 'sl';
      elsif v_signal.take_profit is not null
         and (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) > 0
         and abs(v_exit_price - v_signal.entry_price) >= abs(v_signal.take_profit - v_signal.entry_price) then
        v_exit_price := v_signal.take_profit;
        v_close_trigger := 'tp';
      end if;
    end if;

    -- Result sign always follows side + entry + exit.
    v_is_win := (v_exit_price - v_signal.entry_price) * public.trade_dir(v_side) > 0;

    case v_signal.symbol
      when 'XAUUSD' then v_pip_size := 0.1; v_pip_value_per_lot := 10;
      when 'EURUSD' then v_pip_size := 0.0001; v_pip_value_per_lot := 10;
      when 'GBPUSD' then v_pip_size := 0.0001; v_pip_value_per_lot := 10;
      when 'USDJPY' then v_pip_size := 0.01; v_pip_value_per_lot := 9;
      when 'BTCUSDT' then v_pip_size := 1; v_pip_value_per_lot := 1;
      when 'ETHUSDT' then v_pip_size := 0.1; v_pip_value_per_lot := 1;
      when 'SOLUSDT' then v_pip_size := 0.01; v_pip_value_per_lot := 1;
      when 'BNBUSDT' then v_pip_size := 0.1; v_pip_value_per_lot := 1;
      when 'XRPUSDT' then v_pip_size := 0.0001; v_pip_value_per_lot := 1;
      else v_pip_size := 1; v_pip_value_per_lot := 1;
    end case;

    v_pips := abs(v_exit_price - v_signal.entry_price) / v_pip_size;
    v_risk_fraction := case v_archetype
      when 'flagship' then 0.01 + random() * 0.02
      when 'stable' then 0.005 + random() * 0.015
      when 'good_rr' then 0.01 + random() * 0.015
      when 'high_risk' then 0.02 + random() * 0.06
      when 'struggling' then 0.02 + random() * 0.04
      else 0.01 + random() * 0.02
    end;

    if v_pips > 0 and coalesce(v_signal.account_capital, 0) > 0 then
      v_lot_size := greatest(0.01, least(500, round((v_signal.account_capital * v_risk_fraction / (v_pips * v_pip_value_per_lot))::numeric, 2)));
      v_pnl := round((v_pips * v_pip_value_per_lot * v_lot_size * (case when v_is_win then 1 else -1 end))::numeric, 2);
    else
      v_lot_size := 0.01;
      v_pnl := round((v_notional * greatest(v_pips * v_pip_size / greatest(v_signal.entry_price, 1), 0.001) * (case when v_is_win then 1 else -1 end))::numeric, 2);
    end if;

    v_commission := round((v_lot_size * (3 + random() * 4))::numeric, 2);
    v_days_held := greatest(0, extract(epoch from (now() - v_signal.opened_at)) / 86400);
    v_swap := case
      when v_signal.symbol = any(v_crypto_symbols) or v_days_held < 1 then 0
      else round((v_lot_size * v_days_held * (random() * 3 - 1))::numeric, 2)
    end;

    -- signals_integrity_guard rejects anything inconsistent; one bad row
    -- must not stall the whole engine run, so it stays open and is logged.
    begin
      update public.signals
      set status = 'closed',
          exit_price = v_exit_price,
          lot_size = v_lot_size,
          closed_at = now(),
          close_trigger = v_close_trigger,
          commission = v_commission,
          swap = v_swap
      where id = v_signal.id;
    exception when check_violation then
      raise warning 'run_market_simulation: close of signal % rejected: %', v_signal.id, sqlerrm;
      continue;
    end;

    if v_signal.created_by_admin then
      continue;
    end if;

    v_target_ratio := case v_archetype
      when 'flagship' then 0.25 + random() * 0.15
      when 'stable' then 0.20 + random() * 0.15
      when 'good_rr' then 0.20 + random() * 0.15
      when 'high_risk' then 0.08 + random() * 0.17
      when 'struggling' then 0.05 + random() * 0.10
      else 0.20 + random() * 0.15
    end;
    v_projected_profit := v_signal.total_profit + v_pnl;
    v_withdrawal_bump := case
      when v_projected_profit > 0 and v_pnl > 0 and random() < 0.35 then
        least(
          greatest(0, round(((v_projected_profit * v_target_ratio - v_signal.total_withdrawals) * (0.25 + random() * 0.35))::numeric, 2)),
          round((greatest(0, coalesce(v_signal.account_capital, 0)) * 0.15)::numeric, 2)
        )
      else 0
    end;

    v_follower_delta := case
      when v_is_win and random() < (case when v_archetype in ('flagship', 'high_risk') then 0.45 else 0.20 end)
        then 1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 6 else 3 end))::int
      when (not v_is_win) and v_archetype = 'struggling' and random() < 0.28
        then -(1 + floor(random() * 2)::int)
      when (not v_is_win) and v_archetype <> 'struggling' and random() < 0.07
        then -(1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 3 else 1 end))::int)
      else 0
    end;

    v_follower_cap := case v_archetype
      when 'flagship' then 2500
      when 'high_risk' then 15
      when 'struggling' then 60
      else 600
    end;

    v_profit_ceiling := greatest(50, coalesce(v_signal.account_capital, 0)) * (
      case v_archetype
        when 'flagship' then 12
        when 'stable' then 10
        when 'good_rr' then 12
        when 'high_risk' then 18
        when 'struggling' then 6
        else 10
      end
    );

    update public.providers
    set total_profit = case
          when v_pnl <= 0 then total_profit + v_pnl
          else least(total_profit + v_pnl, greatest(v_profit_ceiling, total_profit))
        end,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta)),
        account_capital = greatest(50, coalesce(account_capital, 0) + v_pnl - v_withdrawal_bump),
        total_volume = coalesce(total_volume, 0) + round((v_lot_size * v_signal.entry_price)::numeric, 2),
        min_copy_amount = case
          when random() < 0.015 then
            greatest(200, min_copy_amount + (case when random() < 0.5 then 1 else -1 end) * (50 * (1 + floor(random() * 3)::int)))
          else min_copy_amount
        end
    where id = v_signal.provider_id;

  end loop;

  for v_provider in
    select id, symbol_bias, session_start_hour, session_end_hour,
      coalesce(risk_archetype, 'balanced') as risk_archetype,
      coalesce(trading_style, 'moderate') as trading_style,
      coalesce(activity_weight, 1) as activity_weight,
      coalesce(skill, 0.55) as skill,
      account_capital,
      coalesce(trading_status, 'active') as trading_status,
      coalesce(margin_call_count, 0) as margin_call_count
    from public.providers
  loop
  -- signals_integrity_guard rejects inconsistent writes; a rejected write
  -- skips this provider for this tick instead of failing the whole run.
  begin
    if v_provider.trading_status = 'stopped' then
      continue;
    end if;

    if v_provider.risk_archetype = 'high_risk' then
      v_margin_call := coalesce(v_provider.account_capital, 0) < 200 or random() < 0.000023;

      if v_margin_call then
        update public.signals s
        set status = 'closed',
            -- a stop that sits closer than the margin-call loss fills first
            exit_price = (
              select case
                when s.stop_loss is not null and abs(m.px - s.entry_price) >= abs(s.stop_loss - s.entry_price)
                  then s.stop_loss
                else m.px
              end
              from (select round((
                case when s.side = 'buy' then s.entry_price * (1 - (0.10 + random() * 0.15))
                     else s.entry_price * (1 + (0.10 + random() * 0.15))
                end
              )::numeric, 4) as px) m
            ),
            closed_at = now(),
            close_trigger = 'margin_call',
            commission = round((coalesce(s.lot_size, 0.01) * (3 + random() * 4))::numeric, 2),
            swap = 0
        where s.provider_id = v_provider.id and s.status = 'open' and s.is_margin_call = true;

        if found then
          v_new_margin_count := v_provider.margin_call_count + 1;
          v_recover_prob := case when v_new_margin_count = 1 then 0.70 when v_new_margin_count = 2 then 0.50 else 0.25 end;

          if random() < v_recover_prob then
            update public.providers
            set account_capital = round(500 + random() * 14500)::numeric,
                trading_status = 'active',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count,
                base_followers_count = 0
            where id = v_provider.id;
          else
            update public.providers
            set account_capital = round(coalesce(v_provider.account_capital, 0) * (0.01 + random() * 0.04), 2),
                trading_status = 'stopped',
                margin_called_at = now(),
                margin_call_count = v_new_margin_count,
                base_followers_count = 0
            where id = v_provider.id;
          end if;

          continue;
        end if;

        update public.signals s
        set status = 'closed',
            -- a stop that sits closer than the margin-call loss fills first
            exit_price = (
              select case
                when s.stop_loss is not null and abs(m.px - s.entry_price) >= abs(s.stop_loss - s.entry_price)
                  then s.stop_loss
                else m.px
              end
              from (select round((
                case when s.side = 'buy' then s.entry_price * (1 - (0.10 + random() * 0.15))
                     else s.entry_price * (1 + (0.10 + random() * 0.15))
                end
              )::numeric, 4) as px) m
            ),
            closed_at = now(),
            close_trigger = 'margin_call',
            commission = round((coalesce(s.lot_size, 0.01) * (3 + random() * 4))::numeric, 2),
            swap = 0
        where s.provider_id = v_provider.id and s.status = 'open';

        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
        if v_symbol = 'US30' then
          v_symbol := 'XAUUSD';
        end if;
        v_side := case when random() < 0.5 then 'buy' else 'sell' end;

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_symbol_idx := array_position(v_symbols, v_symbol);
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        v_entry := round((
          v_anchor * (case when v_side = 'buy' then 1 + (0.15 + random() * 0.15) else 1 - (0.15 + random() * 0.15) end)
        )::numeric, 4);

        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size, is_margin_call)
        values (
          v_provider.id, v_symbol, v_side, v_entry, 'open',
          now() - (floor(random() * 360 + 120) || ' minutes')::interval,
          round((3 + random() * 9)::numeric, 2), true
        );

        continue;
      end if;
    end if;

    v_in_session := true;
    v_window_minutes := null;
    if v_provider.trading_style = 'session_trader' then
      if v_provider.session_start_hour is not null and v_provider.session_end_hour is not null then
        if v_provider.session_start_hour <= v_provider.session_end_hour then
          v_in_session := v_current_hour >= v_provider.session_start_hour and v_current_hour < v_provider.session_end_hour;
          v_window_minutes := (v_provider.session_end_hour - v_provider.session_start_hour) * 60;
        else
          v_in_session := v_current_hour >= v_provider.session_start_hour or v_current_hour < v_provider.session_end_hour;
          v_window_minutes := (24 - v_provider.session_start_hour + v_provider.session_end_hour) * 60;
        end if;
      else
        v_in_session := false;
      end if;
    end if;

    v_micro := greatest(0.75, least(1.25, v_provider.activity_weight));

    v_open_prob := case v_provider.trading_style
      when 'scalper' then 0.019 * v_micro
      when 'moderate' then 0.0035 * v_micro
      when 'sporadic' then 0.0007 * v_micro
      when 'session_trader' then
        case when v_in_session and v_window_minutes is not null then (1.5 * v_micro) / v_window_minutes else 0 end
      else 0.0035 * v_micro
    end;

    select exists (
      select 1 from public.subscriptions rsub
      join public.profiles rfp on rfp.id = rsub.follower_id
      where rsub.provider_id = v_provider.id and rsub.is_active = true
        and rfp.account_type = 'real' and rfp.balance > 0
        and rsub.copy_started_at is not null
        and now() - rsub.copy_started_at >= (
          (10 + abs(('x' || substr(md5(rsub.id::text), 1, 8))::bit(32)::int) % 21) || ' minutes'
        )::interval
    ) into v_has_real_follower;

    if v_has_real_follower then
      select count(*) into v_provider_open_count
      from public.signals where provider_id = v_provider.id and status = 'open';
      v_density_floor := 6 + floor(random() * 8)::int;
      if v_provider_open_count < v_density_floor then
        v_open_prob := least(1, v_open_prob + 0.35);
      end if;
    end if;

    if random() < v_open_prob then
      v_roll := random();
      if v_roll < 0.60 then
        v_symbol := 'XAUUSD';
      elsif v_provider.symbol_bias is not null then
        v_roll := random();
        v_symbol := case
          when v_roll < 0.40 then v_provider.symbol_bias[1]
          when v_roll < 0.68 then v_provider.symbol_bias[2]
          when v_roll < 0.84 then v_provider.symbol_bias[3]
          when v_roll < 0.96 then v_provider.symbol_bias[4]
          else v_provider.symbol_bias[5 + floor(random() * 6)::int]
        end;
      else
        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
      end if;

      if v_symbol = 'US30' then
        v_symbol := 'XAUUSD';
      end if;

      if v_symbol = any(v_forex_symbols) and random() > 0.03 then
        v_symbol := 'XAUUSD';
      end if;

      if not v_market_closed or v_symbol = any(v_crypto_symbols) then
        v_symbol_idx := array_position(v_symbols, v_symbol);

        case v_symbol
          when 'XAUUSD' then v_pip_size := 0.1;
          when 'EURUSD' then v_pip_size := 0.0001;
          when 'GBPUSD' then v_pip_size := 0.0001;
          when 'USDJPY' then v_pip_size := 0.01;
          when 'BTCUSDT' then v_pip_size := 1;
          when 'ETHUSDT' then v_pip_size := 0.1;
          when 'SOLUSDT' then v_pip_size := 0.01;
          when 'BNBUSDT' then v_pip_size := 0.1;
          when 'XRPUSDT' then v_pip_size := 0.0001;
          else v_pip_size := 1;
        end case;

        select price into v_anchor from public.market_prices where symbol = v_symbol;
        if v_anchor is null then
          v_anchor := v_base_prices[v_symbol_idx];
        end if;

        case v_provider.risk_archetype
          when 'high_risk' then
            v_target_pips := 80 + random() * 220;
          when 'struggling' then
            v_target_pips := 50 + random() * 100;
          else
            -- Sporadic (swing/investor) gets a genuinely distant target
            -- (1-4% of price) instead of sharing the same modest
            -- 0.3-0.9% every other non-high-risk/struggling style used
            -- to share regardless of trading_style.
            if v_provider.trading_style = 'sporadic' then
              v_target_pips := (v_anchor * (0.010 + random() * 0.030)) / v_pip_size;
            else
              v_target_pips := (v_anchor * (0.003 + random() * 0.006)) / v_pip_size;
            end if;
        end case;

        if v_provider.trading_style = 'scalper' then
          v_target_pips := 8 + random() * 17;
        end if;

        v_target_distance := v_target_pips * v_pip_size;

        select price into v_lagged_entry
        from public.price_history
        where symbol = v_symbol and abs(price - v_anchor) >= v_target_distance
        order by ts desc limit 1;

        if v_lagged_entry is not null then
          v_entry := v_lagged_entry;
        else
          v_entry := round((v_anchor * (1 + (random() - 0.5) * 0.01))::numeric, 4);
        end if;

        v_side := case when random() < 0.5 then 'buy' else 'sell' end;
        v_is_win := random() < v_provider.skill;

        case v_provider.risk_archetype
          when 'high_risk' then
            v_tp_pips := (v_anchor * (0.05 + random() * 0.10)) / v_pip_size;
          when 'struggling' then
            v_tp_pips := (v_anchor * (0.010 + random() * 0.035)) / v_pip_size;
          else
            if v_provider.trading_style = 'sporadic' then
              v_tp_pips := (v_anchor * (0.015 + random() * 0.045)) / v_pip_size;
            else
              v_tp_pips := (v_anchor * (0.004 + random() * 0.021)) / v_pip_size;
            end if;
        end case;
        case v_provider.risk_archetype
          when 'high_risk' then
            v_sl_pips := (v_anchor * (0.10 + random() * 0.15)) / v_pip_size;
          when 'struggling' then
            v_sl_pips := (v_anchor * (0.008 + random() * 0.027)) / v_pip_size;
          else
            if v_provider.trading_style = 'sporadic' then
              v_sl_pips := (v_anchor * (0.012 + random() * 0.028)) / v_pip_size;
            else
              v_sl_pips := (v_anchor * (0.003 + random() * 0.015)) / v_pip_size;
            end if;
        end case;
        if v_provider.risk_archetype in ('high_risk', 'struggling') then
          if v_is_win then
            v_sl_pips := v_sl_pips * (1.4 + random() * 0.8);
          else
            v_tp_pips := v_tp_pips * (1.4 + random() * 0.8);
          end if;
        else
          if v_is_win then
            v_sl_pips := least(v_sl_pips * (1.2 + random() * 0.3), (v_anchor * 0.035) / v_pip_size);
          else
            v_tp_pips := least(v_tp_pips * (1.2 + random() * 0.3), (v_anchor * 0.035) / v_pip_size);
          end if;
        end if;

        v_roll := random();
        if v_provider.trading_style = 'scalper' then
          v_bucket := case when v_roll < 0.60 then 'both' when v_roll < 0.75 then 'tp_only' when v_roll < 0.90 then 'sl_only' else 'neither' end;
        elsif v_provider.risk_archetype in ('high_risk', 'struggling') then
          v_bucket := case when v_roll < 0.30 then 'both' when v_roll < 0.45 then 'tp_only' when v_roll < 0.70 then 'sl_only' else 'neither' end;
        else
          v_bucket := case when v_roll < 0.45 then 'both' when v_roll < 0.65 then 'tp_only' when v_roll < 0.85 then 'sl_only' else 'neither' end;
        end if;

        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, predetermined_win, take_profit, stop_loss)
        values (
          v_provider.id, v_symbol, v_side, v_entry, 'open', now(), v_is_win,
          case when v_bucket in ('both', 'tp_only') then
            (case when v_side = 'buy' then round((v_entry + v_tp_pips * v_pip_size)::numeric, 4)
                  else round((v_entry - v_tp_pips * v_pip_size)::numeric, 4) end)
            else null end,
          case when v_bucket in ('both', 'sl_only') then
            (case when v_side = 'buy' then round((v_entry - v_sl_pips * v_pip_size)::numeric, 4)
                  else round((v_entry + v_sl_pips * v_pip_size)::numeric, 4) end)
            else null end
        );
      end if;
    end if;
  exception when check_violation then
    raise warning 'run_market_simulation: provider % write rejected: %', v_provider.id, sqlerrm;
  end;
  end loop;
end;
$function$;

commit;

refresh materialized view public.provider_performance_mv;
