-- Advanced copy settings + per-position TP/SL.
--
--  * subscriptions gain copy_mode ('ratio' | 'fixed'), fixed_amount and
--    max_per_trade. The stop-loss of a copy is the existing max_drawdown_pct
--    (the copy stops itself once its realized loss reaches that share of the
--    allocated amount).
--  * mirror_signal_to_followers() sizes each copied position from those
--    settings: ratio -> the whole remaining allocation (as before), fixed -> the
--    fixed amount, always capped by max_per_trade and by what is left.
--  * simulated_positions gain take_profit / stop_loss overrides. A customer sets
--    them with set_my_position_tp_sl(); a market_prices trigger closes the
--    position through settle_copied_position() when the live price crosses one.

begin;

alter table public.subscriptions
  add column if not exists copy_mode text not null default 'ratio',
  add column if not exists fixed_amount numeric,
  add column if not exists max_per_trade numeric;
alter table public.subscriptions drop constraint if exists subscriptions_copy_mode_check;
alter table public.subscriptions add constraint subscriptions_copy_mode_check check (copy_mode in ('ratio', 'fixed'));

alter table public.simulated_positions
  add column if not exists take_profit numeric,
  add column if not exists stop_loss numeric;

-- Copy start / update ---------------------------------------------------------
drop function if exists public.start_or_update_copy(uuid, numeric);

create or replace function public.start_or_update_copy(
  p_provider_id uuid,
  p_allocated_amount numeric,
  p_copy_mode text default 'ratio',
  p_fixed_amount numeric default null,
  p_max_per_trade numeric default null,
  p_stop_loss_pct numeric default null
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
     copy_mode, fixed_amount, max_per_trade)
  values
    (auth.uid(), p_provider_id, true, p_allocated_amount, v_stop_loss, v_new_started_at,
     v_mode, v_fixed, v_max_per_trade)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = v_stop_loss,
        copy_started_at = v_new_started_at,
        copy_mode = v_mode,
        fixed_amount = v_fixed,
        max_per_trade = v_max_per_trade;
end;
$function$;

revoke all on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric) to authenticated;

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

  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
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
    ) as size
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

-- Per-position TP/SL ----------------------------------------------------------------
create or replace function public.set_my_position_tp_sl(
  p_position_id uuid,
  p_take_profit numeric,
  p_stop_loss numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pos record;
  v_side text;
  v_symbol text;
  v_price numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_pos from public.simulated_positions
    where id = p_position_id and follower_id = auth.uid() and status = 'open' for update;
  if not found then
    raise exception 'position_not_found_or_closed' using errcode = 'CM010';
  end if;

  select side, symbol into v_side, v_symbol from public.signals where id = v_pos.signal_id;
  select price into v_price from public.market_prices where symbol = v_symbol;

  if p_take_profit is not null and p_take_profit <= 0 then
    raise exception 'invalid_tp' using errcode = 'CM015';
  end if;
  if p_stop_loss is not null and p_stop_loss <= 0 then
    raise exception 'invalid_sl' using errcode = 'CM016';
  end if;

  if v_price is not null then
    if p_take_profit is not null and ((v_side = 'sell' and p_take_profit >= v_price) or (v_side <> 'sell' and p_take_profit <= v_price)) then
      raise exception 'invalid_tp' using errcode = 'CM015';
    end if;
    if p_stop_loss is not null and ((v_side = 'sell' and p_stop_loss <= v_price) or (v_side <> 'sell' and p_stop_loss >= v_price)) then
      raise exception 'invalid_sl' using errcode = 'CM016';
    end if;
  end if;

  update public.simulated_positions
    set take_profit = p_take_profit, stop_loss = p_stop_loss
    where id = p_position_id;
end;
$function$;

revoke all on function public.set_my_position_tp_sl(uuid, numeric, numeric) from public, anon;
grant execute on function public.set_my_position_tp_sl(uuid, numeric, numeric) to authenticated;

-- Close positions whose own TP/SL was crossed ---------------------------------------
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

  for v_id in
    select sp.id
    from public.simulated_positions sp
    join public.signals s on s.id = sp.signal_id
    where sp.status = 'open'
      and s.symbol = new.symbol
      and (sp.take_profit is not null or sp.stop_loss is not null)
      and (
        (s.side = 'sell' and ((sp.take_profit is not null and new.price <= sp.take_profit)
                              or (sp.stop_loss is not null and new.price >= sp.stop_loss)))
        or
        (s.side <> 'sell' and ((sp.take_profit is not null and new.price >= sp.take_profit)
                               or (sp.stop_loss is not null and new.price <= sp.stop_loss)))
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

revoke all on function public.close_positions_on_tp_sl() from public, anon, authenticated;

drop trigger if exists trg_close_positions_on_tp_sl on public.market_prices;
create trigger trg_close_positions_on_tp_sl
  after update of price on public.market_prices
  for each row execute function public.close_positions_on_tp_sl();

commit;
