-- Per-trade risk settings on a copy: take-profit %, stop-loss % and an
-- optional trailing stop, plus "copy the leader's currently open trades".
-- Rollback: supabase/rollback/0230_copy_trade_risk_settings.sql
--
--  * subscriptions.tp_pct / sl_pct / trailing_pct: percentages of the margin
--    (copied size). A position is unleveraged, so a pct of margin equals the
--    same pct of price movement from the entry price.
--  * mirror_signal_to_followers() stamps every newly copied position with its
--    take_profit / stop_loss price (derived from the entry price) and the
--    trailing percentage; trailing positions also carry best_price, the best
--    price reached since entry.
--  * close_positions_on_tp_sl() (market_prices trigger) additionally keeps
--    best_price current and closes a trailing position once price retraces
--    trail_pct% from best_price.
--  * start_or_update_copy() validates and stores the settings and, on a new
--    copy with p_copy_open, mirrors the leader's open trades at the market.
--  * update_copy_risk_settings() edits them after the copy has started.

begin;

alter table public.subscriptions
  add column if not exists tp_pct numeric,
  add column if not exists sl_pct numeric,
  add column if not exists trailing_pct numeric;
alter table public.subscriptions drop constraint if exists subscriptions_tp_pct_check;
alter table public.subscriptions add constraint subscriptions_tp_pct_check check (tp_pct is null or (tp_pct >= 1 and tp_pct <= 500));
alter table public.subscriptions drop constraint if exists subscriptions_sl_pct_check;
alter table public.subscriptions add constraint subscriptions_sl_pct_check check (sl_pct is null or (sl_pct >= 1 and sl_pct <= 90));
alter table public.subscriptions drop constraint if exists subscriptions_trailing_pct_check;
alter table public.subscriptions add constraint subscriptions_trailing_pct_check check (trailing_pct is null or (trailing_pct >= 0.5 and trailing_pct <= 50));
grant select (tp_pct, sl_pct, trailing_pct) on public.subscriptions to authenticated;

alter table public.simulated_positions
  add column if not exists trail_pct numeric,
  add column if not exists best_price numeric;
grant select (trail_pct, best_price) on public.simulated_positions to authenticated;

create index if not exists simulated_positions_open_trailing_idx
  on public.simulated_positions (signal_id) where status = 'open' and trail_pct is not null;

-- Price level helpers --------------------------------------------------------------
create or replace function public.copy_tp_price(p_side text, p_entry numeric, p_pct numeric)
returns numeric language sql immutable as $$
  select case when p_pct is null then null
              else round(p_entry * (1 + public.trade_dir(p_side) * p_pct / 100), 8) end
$$;
create or replace function public.copy_sl_price(p_side text, p_entry numeric, p_pct numeric)
returns numeric language sql immutable as $$
  select case when p_pct is null then null
              else round(p_entry * (1 - public.trade_dir(p_side) * p_pct / 100), 8) end
$$;

-- Shared validation (raises a distinct code per field) ----------------------------
create or replace function public.validate_copy_risk(p_tp numeric, p_sl numeric, p_trailing numeric)
returns void language plpgsql immutable as $$
begin
  if p_tp is not null and (p_tp < 1 or p_tp > 500) then
    raise exception 'invalid_tp_pct' using errcode = 'CM018';
  end if;
  if p_sl is not null and (p_sl < 1 or p_sl > 90) then
    raise exception 'invalid_sl_pct' using errcode = 'CM019';
  end if;
  if p_trailing is not null and (p_trailing < 0.5 or p_trailing > 50) then
    raise exception 'invalid_trailing_pct' using errcode = 'CM020';
  end if;
end $$;

-- Copy start / update ---------------------------------------------------------------
drop function if exists public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric);

create or replace function public.start_or_update_copy(
  p_provider_id uuid,
  p_allocated_amount numeric,
  p_copy_mode text default 'ratio',
  p_fixed_amount numeric default null,
  p_max_per_trade numeric default null,
  p_stop_loss_pct numeric default null,
  p_tp_pct numeric default null,
  p_sl_pct numeric default null,
  p_trailing_pct numeric default null,
  p_copy_open boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance numeric;
  v_min_copy_amount numeric;
  v_trading_status text;
  v_other_allocated numeric;
  v_existing_id uuid;
  v_existing_started_at timestamptz;
  v_is_starting boolean;
  v_new_started_at timestamptz;
  v_mode text := coalesce(p_copy_mode, 'ratio');
  v_fixed numeric;
  v_max_per_trade numeric;
  v_stop_loss numeric := coalesce(p_stop_loss_pct, 50);
  v_sub_id uuid;
  v_sig record;
  v_open_total numeric;
  v_size numeric;
begin
  if p_allocated_amount is null or p_allocated_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'CM001';
  end if;

  if v_mode not in ('ratio', 'fixed') then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_fixed := case when v_mode = 'fixed' then p_fixed_amount else null end;
  if v_mode = 'fixed' and (v_fixed is null or v_fixed <= 0 or v_fixed > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_max_per_trade := p_max_per_trade;
  if v_max_per_trade is not null and (v_max_per_trade <= 0 or v_max_per_trade > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  if v_stop_loss < 1 or v_stop_loss > 90 then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  perform public.validate_copy_risk(p_tp_pct, p_sl_pct, p_trailing_pct);

  select balance into v_balance from public.profiles where id = auth.uid();
  select min_copy_amount, trading_status into v_min_copy_amount, v_trading_status
    from public.providers where id = p_provider_id;

  if v_min_copy_amount is null then
    raise exception 'provider_not_found' using errcode = 'CM002';
  end if;

  if v_trading_status = 'stopped' then
    raise exception 'trader_stopped' using errcode = 'CM003';
  end if;

  select id, copy_started_at into v_existing_id, v_existing_started_at
    from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  v_is_starting := v_existing_id is null;

  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.whitelist_enabled
  ) and not exists (
    select 1 from public.follower_invites fi
    where fi.provider_id = p_provider_id and fi.used_by = auth.uid()
  ) then
    raise exception 'not_invited' using errcode = 'CM008';
  end if;

  if not v_is_starting and now() - v_existing_started_at >= interval '10 minutes' then
    raise exception 'grace_period_expired' using errcode = 'CM004';
  end if;

  select coalesce(sum(allocated_amount), 0) into v_other_allocated
    from public.subscriptions
    where follower_id = auth.uid() and is_active = true and provider_id <> p_provider_id;

  if p_allocated_amount > coalesce(v_balance, 0) - v_other_allocated then
    raise exception 'exceeds_balance' using errcode = 'CM006';
  end if;

  if p_allocated_amount < v_min_copy_amount then
    raise exception 'below_minimum' using errcode = 'CM007';
  end if;

  v_new_started_at := case when v_is_starting then now() else v_existing_started_at end;

  insert into public.subscriptions
    (follower_id, provider_id, is_active, allocated_amount, max_drawdown_pct, copy_started_at,
     copy_mode, fixed_amount, max_per_trade, tp_pct, sl_pct, trailing_pct)
  values
    (auth.uid(), p_provider_id, true, p_allocated_amount, v_stop_loss, v_new_started_at,
     v_mode, v_fixed, v_max_per_trade, p_tp_pct, p_sl_pct, p_trailing_pct)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = v_stop_loss,
        copy_started_at = v_new_started_at,
        copy_mode = v_mode,
        fixed_amount = v_fixed,
        max_per_trade = v_max_per_trade,
        tp_pct = p_tp_pct,
        sl_pct = p_sl_pct,
        trailing_pct = p_trailing_pct
  returning id into v_sub_id;

  -- Copy the leader's trades that are open right now, at the current market
  -- price, sized exactly like a freshly mirrored trade.
  if v_is_starting and coalesce(p_copy_open, false) then
    for v_sig in
      select s.id, s.side, mp.price
      from public.signals s
      join public.market_prices mp on mp.symbol = s.symbol
      where s.provider_id = p_provider_id
        and s.status = 'open'
        and coalesce(s.hidden, false) = false
        and not s.created_by_admin
        and mp.price is not null and mp.price > 0
      order by s.opened_at
    loop
      select coalesce(sum(size), 0) into v_open_total
        from public.simulated_positions where subscription_id = v_sub_id and status = 'open';
      v_size := least(
        case when v_mode = 'fixed' and v_fixed is not null
             then least(v_fixed, p_allocated_amount - v_open_total)
             else p_allocated_amount - v_open_total end,
        coalesce(v_max_per_trade, p_allocated_amount)
      );
      exit when v_size <= 0;

      insert into public.simulated_positions
        (signal_id, subscription_id, follower_id, entry_price, size, take_profit, stop_loss, trail_pct, best_price)
      values
        (v_sig.id, v_sub_id, auth.uid(), v_sig.price, v_size,
         public.copy_tp_price(v_sig.side, v_sig.price, p_tp_pct),
         public.copy_sl_price(v_sig.side, v_sig.price, p_sl_pct),
         p_trailing_pct,
         case when p_trailing_pct is not null then v_sig.price end);
    end loop;
  end if;
end;
$function$;

revoke all on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) from public, anon;
grant execute on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) to authenticated;

-- Edit after the copy has started --------------------------------------------------
create or replace function public.update_copy_risk_settings(
  p_provider_id uuid,
  p_tp_pct numeric,
  p_sl_pct numeric,
  p_trailing_pct numeric,
  p_apply_to_open boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sub_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.validate_copy_risk(p_tp_pct, p_sl_pct, p_trailing_pct);

  select id into v_sub_id from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true for update;
  if v_sub_id is null then
    raise exception 'copy_not_found' using errcode = 'CM021';
  end if;

  update public.subscriptions
    set tp_pct = p_tp_pct, sl_pct = p_sl_pct, trailing_pct = p_trailing_pct
    where id = v_sub_id;

  if coalesce(p_apply_to_open, false) then
    update public.simulated_positions sp
      set take_profit = public.copy_tp_price(s.side, sp.entry_price, p_tp_pct),
          stop_loss = public.copy_sl_price(s.side, sp.entry_price, p_sl_pct),
          trail_pct = p_trailing_pct,
          best_price = case when p_trailing_pct is null then null
                            else coalesce(mp.price, sp.entry_price) end
      from public.signals s
      left join public.market_prices mp on mp.symbol = s.symbol
      where s.id = sp.signal_id and sp.subscription_id = v_sub_id and sp.status = 'open';
  end if;
end;
$function$;

revoke all on function public.update_copy_risk_settings(uuid, numeric, numeric, numeric, boolean) from public, anon;
grant execute on function public.update_copy_risk_settings(uuid, numeric, numeric, numeric, boolean) to authenticated;

-- Mirroring -----------------------------------------------------------------------
create or replace function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_provider_name text;
begin
  if new.created_by_admin then
    return new;
  end if;

  insert into public.simulated_positions
    (signal_id, subscription_id, follower_id, entry_price, size, take_profit, stop_loss, trail_pct, best_price)
  select
    new.id,
    sub.id,
    sub.follower_id,
    new.entry_price,
    least(
      case when sub.copy_mode = 'fixed' and sub.fixed_amount is not null
           then least(sub.fixed_amount, sub.allocated_amount - coalesce(open_totals.total_open, 0))
           else sub.allocated_amount - coalesce(open_totals.total_open, 0) end,
      coalesce(sub.max_per_trade, sub.allocated_amount)
    ) as size,
    public.copy_tp_price(new.side, new.entry_price, sub.tp_pct),
    public.copy_sl_price(new.side, new.entry_price, sub.sl_pct),
    sub.trailing_pct,
    case when sub.trailing_pct is not null then new.entry_price end
  from public.subscriptions sub
  left join lateral (
    select coalesce(sum(sp.size), 0) as total_open
    from public.simulated_positions sp
    where sp.subscription_id = sub.id and sp.status = 'open'
  ) open_totals on true
  where sub.provider_id = new.provider_id
    and sub.is_active = true
    and sub.allocated_amount > coalesce(open_totals.total_open, 0);

  if exists (select 1 from public.follows where provider_id = new.provider_id) then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = new.provider_id;

    insert into public.notifications (user_id, type, title, body, data)
    select
      f.follower_id,
      'followed_trade_opened',
      'فتح صفقة جديدة | ' || coalesce(v_provider_name, 'متداول'),
      'قام ' || coalesce(v_provider_name, 'متداول') || ' بفتح صفقة ' ||
        (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        '. يمكنك مراجعة التفاصيل الآن.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side
      )
    from public.follows f
    where f.provider_id = new.provider_id;
  end if;

  return new;
end;
$function$;

-- Close on TP / SL / trailing ---------------------------------------------------------
create or replace function public.close_positions_on_tp_sl()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if new.price is null or new.price = old.price then
    return new;
  end if;

  -- Trailing stop: remember the best price each trailing position has seen.
  update public.simulated_positions sp
    set best_price = case when s.side = 'sell'
                          then least(coalesce(sp.best_price, sp.entry_price), new.price)
                          else greatest(coalesce(sp.best_price, sp.entry_price), new.price) end
    from public.signals s
    where s.id = sp.signal_id and s.symbol = new.symbol
      and sp.status = 'open' and sp.trail_pct is not null;

  for v_id in
    select sp.id
    from public.simulated_positions sp
    join public.signals s on s.id = sp.signal_id
    where sp.status = 'open'
      and s.symbol = new.symbol
      and (sp.take_profit is not null or sp.stop_loss is not null or sp.trail_pct is not null)
      and (
        (s.side = 'sell' and ((sp.take_profit is not null and new.price <= sp.take_profit)
                              or (sp.stop_loss is not null and new.price >= sp.stop_loss)
                              or (sp.trail_pct is not null and new.price >= sp.best_price * (1 + sp.trail_pct / 100))))
        or
        (s.side <> 'sell' and ((sp.take_profit is not null and new.price >= sp.take_profit)
                               or (sp.stop_loss is not null and new.price <= sp.stop_loss)
                               or (sp.trail_pct is not null and new.price <= sp.best_price * (1 - sp.trail_pct / 100))))
      )
  loop
    begin
      perform public.settle_copied_position(v_id, new.price, now());
    exception when others then
      null; -- never block a price update because one position could not settle
    end;
  end loop;

  return new;
end;
$function$;

commit;
