-- Rollback of 0230_copy_trade_risk_settings.sql: restores the 0227 definitions of
-- start_or_update_copy / mirror_signal_to_followers / close_positions_on_tp_sl and
-- drops everything 0230 added. Existing positions keep their TP/SL prices; copies
-- lose their per-trade percentages and any trailing stop.

begin;

drop function if exists public.update_copy_risk_settings(uuid, numeric, numeric, numeric, boolean);
drop function if exists public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean);

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

drop index if exists public.simulated_positions_open_trailing_idx;
alter table public.simulated_positions drop column if exists trail_pct, drop column if exists best_price;
alter table public.subscriptions
  drop constraint if exists subscriptions_tp_pct_check,
  drop constraint if exists subscriptions_sl_pct_check,
  drop constraint if exists subscriptions_trailing_pct_check,
  drop column if exists tp_pct, drop column if exists sl_pct, drop column if exists trailing_pct;

drop function if exists public.validate_copy_risk(numeric, numeric, numeric);
drop function if exists public.copy_tp_price(text, numeric, numeric);
drop function if exists public.copy_sl_price(text, numeric, numeric);

commit;
