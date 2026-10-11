-- 0252: deposits switch, copy rules, column-level read access.
--
-- 1. platform_settings.deposits_enabled (false) is the one switch for deposits.
--    sim_leaders_open_to_real() is now NOT deposits_enabled: open while deposits are off,
--    closed automatically (leaders restricted per copy_check_leader_account) once they are on.
--    The old 'sim_leaders_open_to_real' setting row is retired.
-- 2. crypto_deposit_submit refuses while deposits are off.
-- 3. start_or_update_copy: a leader with accepting_followers = false takes no new copiers;
--    with deposits on, a real account needs an approved KYC to start a copy.
-- 4. Policies that read providers.user_id move to owns_provider() (security definer), so the
--    column can be hidden; signals_select(_public) also keep admin-created rows out of the
--    public record, so clients no longer filter on created_by_admin.
-- 5. Column-level SELECT: signals (without predetermined_win, needs_review, review_reasons,
--    is_margin_call, created_by_admin) and providers (without persona, skill, rr_ratio,
--    activity_weight, user_id, is_simulated).
-- 6. provider_cards no longer returns is_simulated.
--
-- Rollback: supabase/rollback/0252_deposits_switch_and_column_privileges.sql

begin;

-- 1. switch -------------------------------------------------------------------------------
insert into public.platform_settings (key, value) values ('deposits_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.deposits_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'deposits_enabled'), false);
$$;
grant execute on function public.deposits_enabled() to anon, authenticated;

create or replace function public.sim_leaders_open_to_real()
returns boolean language sql stable security definer set search_path = public as $$
  select not public.deposits_enabled();
$$;
grant execute on function public.sim_leaders_open_to_real() to anon, authenticated;

delete from public.platform_settings where key = 'sim_leaders_open_to_real';

-- 2. deposits -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crypto_deposit_submit(p_user uuid, p_network text, p_tx_hash text)
 RETURNS crypto_deposits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_net public.crypto_networks;
  v_address text;
  v_hash text := lower(regexp_replace(coalesce(p_tx_hash, ''), '^\s*(0x)?|\s+$', '', 'gi'));
  v_row public.crypto_deposits;
begin
  if not public.deposits_enabled() then
    raise exception 'deposits_disabled' using errcode = 'CM035';
  end if;
  if (select account_type from public.profiles where id = p_user) is distinct from 'real' then
    raise exception 'real_account_only' using errcode = 'CM012';
  end if;
  select * into v_net from public.crypto_networks where id = p_network;
  v_address := public.crypto_deposit_address_for(p_user, p_network);
  if v_net.id is null or v_address is null then
    raise exception 'deposit_network_unavailable' using errcode = 'CM030';
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_tx_hash' using errcode = 'CM031';
  end if;
  if exists (select 1 from public.crypto_deposits where tx_hash = v_hash and status <> 'failed') then
    raise exception 'tx_already_submitted' using errcode = 'CM032';
  end if;
  if (select count(*) from public.crypto_deposits where user_id = p_user and status = 'pending') >= 5 then
    raise exception 'too_many_pending' using errcode = 'CM033';
  end if;
  if (select count(*) from public.crypto_deposits where user_id = p_user and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too_many_attempts' using errcode = 'CM034';
  end if;

  insert into public.crypto_deposits (user_id, network, tx_hash, deposit_address, required_confirmations)
  values (p_user, p_network, v_hash, v_address, v_net.confirmations)
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'tx_already_submitted' using errcode = 'CM032';
end $function$;

-- 3. copy rules ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_or_update_copy(p_provider_id uuid, p_allocated_amount numeric, p_copy_mode text DEFAULT 'ratio'::text, p_fixed_amount numeric DEFAULT NULL::numeric, p_max_per_trade numeric DEFAULT NULL::numeric, p_stop_loss_pct numeric DEFAULT NULL::numeric, p_tp_pct numeric DEFAULT NULL::numeric, p_sl_pct numeric DEFAULT NULL::numeric, p_trailing_pct numeric DEFAULT NULL::numeric, p_copy_open boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Leader / account visibility rules live in copy_check_leader_account (driven by deposits_enabled).
  perform public.copy_check_leader_account(p_provider_id, auth.uid());

  select id, copy_started_at into v_existing_id, v_existing_started_at
    from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  v_is_starting := v_existing_id is null;

  -- A leader who is not accepting followers takes no new copiers (existing copies keep running).
  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.accepting_followers = false
  ) then
    raise exception 'not_accepting_followers' using errcode = 'CM051';
  end if;

  -- With deposits switched on, a real account needs an approved KYC to start a copy.
  if v_is_starting and public.deposits_enabled()
     and exists (select 1 from public.profiles where id = auth.uid() and account_type = 'real')
     and not public.kyc_is_approved(auth.uid()) then
    raise exception 'kyc_required' using errcode = 'CM052';
  end if;

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

-- 4. ownership helpers and policies -------------------------------------------------------
create or replace function public.owns_provider(p_provider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.providers where id = p_provider_id and user_id = auth.uid());
$$;
revoke all on function public.owns_provider(uuid) from public, anon;
grant execute on function public.owns_provider(uuid) to authenticated;

create or replace function public.own_provider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.providers where user_id = auth.uid() limit 1;
$$;
revoke all on function public.own_provider_id() from public, anon;
grant execute on function public.own_provider_id() to authenticated;

alter policy follower_invites_insert_own on public.follower_invites with check (public.owns_provider(provider_id));
alter policy follower_invites_select_own on public.follower_invites using (public.owns_provider(provider_id));
alter policy lead_trader_announcements_insert_own on public.lead_trader_announcements with check (public.owns_provider(provider_id));
alter policy lead_trader_announcements_select_own on public.lead_trader_announcements using (public.owns_provider(provider_id));
alter policy lead_trader_follower_removals_select_own on public.lead_trader_follower_removals using (public.owns_provider(provider_id));
alter policy lead_trader_profiles_all_own on public.lead_trader_profiles
  using (public.owns_provider(provider_id)) with check (public.owns_provider(provider_id));
alter policy profit_share_ledger_select_provider on public.profit_share_ledger using (public.owns_provider(provider_id));
alter policy subscriptions_select_provider on public.subscriptions using (public.owns_provider(provider_id));
alter policy simulated_positions_select_provider on public.simulated_positions
  using (exists (select 1 from public.subscriptions s where s.id = simulated_positions.subscription_id and public.owns_provider(s.provider_id)));

alter policy signals_select on public.signals using (
  (
    (not hidden)
    and ((select public.viewer_sees_simulated()) or provider_id = any (coalesce((select public.real_provider_ids()), '{}'::uuid[])))
    and ((not created_by_admin) or public.current_user_is_admin())
  )
  or exists (select 1 from public.simulated_positions sp where sp.signal_id = signals.id and sp.follower_id = auth.uid())
);
alter policy signals_select_public on public.signals using (
  (not hidden) and (not created_by_admin)
  and ((select public.viewer_sees_simulated()) or provider_id = any (coalesce((select public.real_provider_ids()), '{}'::uuid[])))
);

-- 5. column-level read access ---------------------------------------------------------------
revoke select on public.signals from anon, authenticated;
grant select (id, provider_id, symbol, side, entry_price, stop_loss, take_profit, exit_price, status,
              opened_at, closed_at, lot_size, close_trigger, commission, swap, hidden, pnl_usd, return_pct)
  on public.signals to anon, authenticated;

revoke select on public.providers from anon, authenticated;
grant select (id, bio, created_at, display_name, base_followers_count, total_profit, total_withdrawals,
              min_copy_amount, symbol_bias, risk_archetype, account_capital, session_start_hour,
              session_end_hour, country, trading_style, trading_status, margin_called_at,
              margin_call_count, avatar_url, is_archived, total_volume, profit_share_pct)
  on public.providers to authenticated;

-- 6. provider_cards without is_simulated ----------------------------------------------------
drop view public.provider_cards;
create view public.provider_cards as
SELECT p.id AS provider_id,
    p.bio,
    COALESCE(pr.display_name, p.display_name) AS display_name,
    COALESCE(st.followers, 0) AS followers_count,
    ( SELECT count(*) AS count
           FROM signals s
          WHERE s.provider_id = p.id AND s.status = 'open'::text AND NOT s.hidden AND NOT s.created_by_admin) AS open_signals,
    COALESCE(st.trades_all, 0) AS closed_signals,
    st.win_rate_all AS win_rate_pct,
    st.avg_trade_return AS avg_return_pct,
    p.created_at AS joined_at,
    COALESCE(st.pnl_all, 0::numeric) AS total_profit,
    COALESCE(st.total_withdrawals, 0::numeric) AS total_withdrawals,
    p.min_copy_amount,
    COALESCE(st.vol_daily_pct, 0::numeric) AS return_volatility,
    st.risk_level,
    st.rating_score,
    st.tier,
    st.avg_daily_return_pct,
    p.country,
    p.account_capital,
    p.trading_status,
    p.margin_called_at,
    p.avatar_url,
    p.is_archived,
    p.symbol_bias,
    st.primary_symbol,
    p.profit_share_pct,
    st.roi_7d,
    st.roi_30d,
    st.roi_90d,
    st.roi_180d,
    st.roi_all,
    st.pnl_7d,
    st.pnl_30d,
    st.pnl_90d,
    st.pnl_180d,
    st.pnl_all,
    st.trades_7d,
    st.trades_30d,
    st.trades_90d,
    st.trades_180d,
    st.trades_all,
    st.win_rate_7d,
    st.win_rate_30d,
    st.win_rate_90d,
    st.win_rate_180d,
    st.win_rate_all,
    st.mdd_7d,
    st.mdd_30d,
    st.mdd_90d,
    st.mdd_180d,
    st.mdd_all,
    st.sharpe_7d,
    st.sharpe_30d,
    st.sharpe_90d,
    st.sharpe_180d,
    st.sharpe_all,
    st.avg_win_pct,
    st.avg_loss_pct,
    st.profit_factor,
    st.positive_months,
    st.months_counted,
    st.active_days,
    st.track_days,
    st.first_day,
    st.total_deposits,
    st.aum,
    st.avg_hold_hours,
    st.trades_per_week,
    st.limit_pct,
    st.asset_mix,
    st.primary_asset,
    st.style
   FROM providers p
     LEFT JOIN profiles pr ON pr.id = p.user_id
     LEFT JOIN provider_stats st ON st.provider_id = p.id
  WHERE NOT p.is_simulated OR ( SELECT viewer_sees_simulated() AS viewer_sees_simulated);
grant select on public.provider_cards to anon, authenticated, service_role;

commit;
