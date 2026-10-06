-- Security hardening found in the full security audit.
-- Rollback: supabase/rollback/0245_security_hardening.sql
--
--  1. kyc_submissions / lead_trader_applications: the INSERT policies only checked user_id, and
--     the column grants include status -- a customer could insert a row that is already
--     'approved' straight through the REST API (identity verification is what unlocks real
--     withdrawals). New rows must now start 'pending' with no review fields.
--  2. Internal engine functions (SECURITY DEFINER) were executable by every signed-in customer:
--     sim_close_trade closes any simulated leader's open trade at a price the caller chooses,
--     provider_daily_apply edits leader statistics, and so on. They are only ever called by
--     pg_cron, triggers and other SECURITY DEFINER functions (all run as the owner), so EXECUTE
--     is revoked from PUBLIC / anon / authenticated.
--  3. check_rate_limit was callable by anyone holding the public anon key: an attacker could burn
--     another person's login / 2FA bucket (lock-out) or flood rate_limits. The server now calls
--     it with the service role and the RPC is closed to browsers.
--  4. start_or_update_copy locked only (user, leader), so two copies started at once on different
--     leaders could each be allocated the whole balance. It now locks the customer's profile row
--     (the same lock withdrawals take), so allocations are checked one at a time.
--  5. TRUNCATE / TRIGGER / REFERENCES were granted to anon and authenticated on every table
--     (TRUNCATE ignores row level security); writes were granted on engine-only tables that have
--     no policy. Removed.
--  6. New functions no longer get EXECUTE for PUBLIC / anon / authenticated by default; a
--     migration that adds a customer-facing function must grant it explicitly.

begin;

-- 1. Insert policies ---------------------------------------------------------------------------
drop policy if exists kyc_insert_own on public.kyc_submissions;
create policy kyc_insert_own on public.kyc_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null);

drop policy if exists lead_trader_applications_insert_own on public.lead_trader_applications;
create policy lead_trader_applications_insert_own on public.lead_trader_applications for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending'
    and provider_id is null and reviewer_admin_id is null and reviewed_at is null and rejection_reason is null
  );

-- 2 + 3. Engine / internal functions ------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'sim_close_trade', 'sim_open_trade', 'sim_advance_trade', 'provider_daily_apply',
        'refresh_provider_stats', 'refresh_dirty_provider_stats', 'run_daily_leader_maintenance',
        'mark_provider_stats_dirty', 'refresh_sim_symbol_volatility', 'copy_check_leader_account',
        'email_category_enabled', 'notification_account_type', 'check_rate_limit')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 4. Copy allocation lock ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_or_update_copy(p_provider_id uuid, p_allocated_amount numeric, p_copy_mode text DEFAULT 'ratio'::text, p_fixed_amount numeric DEFAULT NULL::numeric, p_max_per_trade numeric DEFAULT NULL::numeric, p_stop_loss_pct numeric DEFAULT NULL::numeric, p_tp_pct numeric DEFAULT NULL::numeric, p_sl_pct numeric DEFAULT NULL::numeric, p_trailing_pct numeric DEFAULT NULL::numeric, p_copy_open boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$;
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

  select balance into v_balance from public.profiles where id = auth.uid() for update;
  select min_copy_amount, trading_status into v_min_copy_amount, v_trading_status
    from public.providers where id = p_provider_id;

  if v_min_copy_amount is null then
    raise exception 'provider_not_found' using errcode = 'CM002';
  end if;

  if v_trading_status = 'stopped' then
    raise exception 'trader_stopped' using errcode = 'CM003';
  end if;

  -- Simulated leaders can only be copied from a demo account.
  perform public.copy_check_leader_account(p_provider_id, auth.uid());

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


-- 5. Table grants ------------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- Engine-only tables (no policy: row level security already denies customers, this removes the grant too).
revoke all on public.rate_limits, public.platform_settings, public.provider_stats, public.provider_daily,
  public.provider_cash_flows, public.sim_symbols, public.sim_trade_plans from anon, authenticated;
revoke insert, update, delete on public.market_prices, public.price_history from anon, authenticated;

-- 6. Default privileges --------------------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

commit;
