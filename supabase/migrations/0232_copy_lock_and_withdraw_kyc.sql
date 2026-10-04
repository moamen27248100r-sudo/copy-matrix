-- Copy lock + KYC for real withdrawals.
-- Rollback: supabase/rollback/0232_copy_lock_and_withdraw_kyc.sql
--
--  * Copy settings: with no copied trade open the customer can change everything (amount, mode,
--    per-trade cap, copy stop-loss, take profit / stop loss / trailing) and stop the copy. While a
--    copied trade is open the amount, mode, per-trade cap and copy stop-loss are locked (CM004);
--    take profit / stop loss / trailing remain editable. The old "locked 10 minutes after starting"
--    rule is gone: only an actual open trade locks anything. Once the last trade closes the lock lifts.
--  * Withdrawals (demo and real) are refused while a copied trade is open (CM023).
--  * A real-account withdrawal request needs approved identity verification (CM024). Demo is exempt.

begin;

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
  v_provider_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Two simultaneous submits (double click, second tab) must not both count as "starting".
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_provider_id::text, 0));

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

  -- While a copied trade is open the amount, mode, per-trade cap and copy stop-loss are locked;
  -- take profit / stop loss / trailing stay editable. With nothing open everything is editable.
  if not v_is_starting and exists (
    select 1 from public.simulated_positions where subscription_id = v_existing_id and status = 'open'
  ) and exists (
    select 1 from public.subscriptions s
    where s.id = v_existing_id
      and (s.allocated_amount is distinct from p_allocated_amount
        or s.copy_mode is distinct from v_mode
        or s.fixed_amount is distinct from v_fixed
        or s.max_per_trade is distinct from v_max_per_trade
        or s.max_drawdown_pct is distinct from v_stop_loss)
  ) then
    raise exception 'copy_locked_open_positions' using errcode = 'CM004';
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
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = p_provider_id;

    for v_sig in
      select s.id, s.side, s.symbol, mp.price
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

      insert into public.notifications (user_id, type, title, body, data)
      values (
        auth.uid(),
        'copy_opened',
        'تم نسخ صفقة جديدة',
        'نُسخت صفقة ' || (case when v_sig.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || v_sig.symbol ||
          ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
        jsonb_build_object(
          'providerName', coalesce(v_provider_name, 'متداول'),
          'symbol', v_sig.symbol,
          'side', v_sig.side,
          'size', v_size,
          'price', v_sig.price
        )
      );
    end loop;
  end if;
end;
$function$;

revoke all on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) from public, anon;
grant execute on function public.start_or_update_copy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean) to authenticated;

create or replace function public.kyc_is_approved(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status from public.kyc_submissions where user_id = p_user order by submitted_at desc limit 1) = 'approved', false)
$$;
revoke all on function public.kyc_is_approved(uuid) from public, anon, authenticated;

create or replace function public.wallet_requests_real_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select account_type from public.profiles where id = new.user_id) <> 'real' then
    raise exception 'demo_account_no_requests' using errcode = 'CM012';
  end if;
  new.account_type := 'real';
  if new.type = 'withdrawal' then
    if exists (select 1 from public.simulated_positions where follower_id = new.user_id and status = 'open') then
      raise exception 'withdraw_locked_open_positions' using errcode = 'CM023';
    end if;
    if not public.kyc_is_approved(new.user_id) then
      raise exception 'kyc_required' using errcode = 'CM024';
    end if;
  end if;
  return new;
end $$;

create or replace function public.demo_withdraw(p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_type text; v_balance numeric; v_reserved numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'CM001'; end if;
  select account_type, balance into v_type, v_balance from public.profiles where id = auth.uid() for update;
  if v_type <> 'demo' then raise exception 'not_demo_account' using errcode = 'CM014'; end if;
  if exists (select 1 from public.simulated_positions where follower_id = auth.uid() and status = 'open') then
    raise exception 'withdraw_locked_open_positions' using errcode = 'CM023';
  end if;
  select coalesce(sum(allocated_amount), 0) into v_reserved
    from public.subscriptions where follower_id = auth.uid() and is_active = true;
  if p_amount > v_balance - v_reserved then raise exception 'exceeds_balance' using errcode = 'CM006'; end if;
  update public.profiles set balance = balance - p_amount where id = auth.uid() returning balance into v_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
  values (auth.uid(), 'withdrawal', -p_amount, v_balance, 'demo_withdrawal', 'demo');
  return v_balance;
end $$;
revoke all on function public.demo_withdraw(numeric) from public, anon;
grant execute on function public.demo_withdraw(numeric) to authenticated;

create or replace function public.apply_wallet_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_balance numeric;
  v_reserved numeric;
begin
  if new.status = 'approved' and old.status = 'pending' then
    select account_type into v_type from public.profiles where id = new.user_id for update;

    if new.type = 'withdrawal' then
      if v_type = 'real' then
        if exists (select 1 from public.simulated_positions where follower_id = new.user_id and status = 'open') then
          raise exception 'Withdrawal unavailable while positions are open. Close them and submit the request again.';
        end if;
        select balance into v_balance from public.profiles where id = new.user_id;
        select coalesce(sum(allocated_amount), 0) into v_reserved
          from public.subscriptions where follower_id = new.user_id and is_active = true;
        v_balance := v_balance - v_reserved;
      else
        select other_balance into v_balance from public.profiles where id = new.user_id;
      end if;
      if v_balance < new.amount then
        raise exception 'Insufficient available balance.';
      end if;
      if v_type = 'real' then
        update public.profiles set balance = balance - new.amount where id = new.user_id returning balance into v_balance;
      else
        update public.profiles set other_balance = other_balance - new.amount where id = new.user_id returning other_balance into v_balance;
      end if;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
      values (new.user_id, 'withdrawal', -new.amount, v_balance, 'withdrawal_completed', 'real');
    else
      if v_type = 'real' then
        update public.profiles set balance = balance + new.amount where id = new.user_id returning balance into v_balance;
      else
        update public.profiles set other_balance = other_balance + new.amount where id = new.user_id returning other_balance into v_balance;
      end if;
      insert into public.wallet_transactions (user_id, type, amount, balance_after, note, account_type)
      values (new.user_id, 'deposit', new.amount, v_balance, 'deposit_completed', 'real');
    end if;

    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body, data)
    values (new.user_id, 'wallet_' || new.type || '_approved',
      case when new.type = 'deposit' then 'Deposit completed' else 'Withdrawal completed' end,
      'Your ' || new.type || ' of ' || new.amount || ' USDT is complete.',
      jsonb_build_object('amount', new.amount));
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.reviewed_at := now();
    insert into public.notifications (user_id, type, title, body, data)
    values (new.user_id, 'wallet_' || new.type || '_rejected',
      case when new.type = 'deposit' then 'Deposit rejected' else 'Withdrawal rejected' end,
      'Your ' || new.type || ' request could not be completed. Contact support for details.',
      '{}'::jsonb);
  end if;
  return new;
end $$;

commit;
