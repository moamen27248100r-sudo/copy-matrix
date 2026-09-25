-- Security audit follow-up (medium severity): subscriptions_insert_own /
-- subscriptions_update_own only ever checked row ownership
-- (follower_id = auth.uid()), same class of gap already fixed for profiles
-- in 0180. The actual business rules -- allocated_amount can't exceed the
-- customer's balance or fall below the leader's min_copy_amount, only one
-- active copy at a time, the 10-minute grace-period lock on amount edits,
-- and refusing to start a copy on a stopped leader -- were only ever
-- enforced in discover/actions.ts's followProvider(), all bypassable via a
-- raw API call with the customer's own JWT.
--
-- This app already has exactly the right established pattern for this: a
-- SECURITY DEFINER RPC (stop_copy(), used by unfollowProvider() since
-- 0091_reserve_allocated_capital.sql) that re-validates everything
-- server-side using auth.uid() internally rather than trusting a
-- client-supplied id. start_or_update_copy() below is the same pattern for
-- starting/editing a copy, using custom SQLSTATEs (CM001-CM007) so the
-- Next.js layer can still show the right translated message per failure
-- reason (mirrors this file's own per-case error handling, not raw DB text).
create or replace function public.start_or_update_copy(
  p_provider_id uuid,
  p_allocated_amount numeric
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance numeric;
  v_min_copy_amount numeric;
  v_trading_status text;
  v_other_active_provider uuid;
  v_existing_id uuid;
  v_existing_started_at timestamptz;
  v_is_starting boolean;
  v_new_started_at timestamptz;
begin
  if p_allocated_amount is null or p_allocated_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'CM001';
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

  if not v_is_starting and now() - v_existing_started_at >= interval '10 minutes' then
    raise exception 'grace_period_expired' using errcode = 'CM004';
  end if;

  if v_is_starting then
    select provider_id into v_other_active_provider
      from public.subscriptions
      where follower_id = auth.uid() and is_active = true and provider_id <> p_provider_id
      limit 1;
    if v_other_active_provider is not null then
      raise exception 'already_copying_other' using errcode = 'CM005';
    end if;
  end if;

  if p_allocated_amount > coalesce(v_balance, 0) then
    raise exception 'exceeds_balance' using errcode = 'CM006';
  end if;

  if p_allocated_amount < v_min_copy_amount then
    raise exception 'below_minimum' using errcode = 'CM007';
  end if;

  v_new_started_at := case when v_is_starting then now() else v_existing_started_at end;

  insert into public.subscriptions (follower_id, provider_id, is_active, allocated_amount, max_drawdown_pct, copy_started_at)
  values (auth.uid(), p_provider_id, true, p_allocated_amount, 50, v_new_started_at)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = 50,
        copy_started_at = v_new_started_at;
end;
$function$;

-- Same table-level-revoke-then-narrow-regrant as 0180: no direct-client
-- INSERT remains legitimate at all now that followProvider() goes through
-- the RPC above; is_active is the only UPDATE column with a genuine direct
-- write path left (settings/actions.ts and auth/actions.ts intentionally
-- force-stop every active copy on an account-type switch, bypassing
-- stop_copy()'s open-position check on purpose -- the balance itself is
-- being reset, so any reserved capital becomes moot). allocated_amount /
-- copy_started_at / max_drawdown_pct / provider_id / follower_id must only
-- ever change through start_or_update_copy() or stop_copy() from here on.
revoke insert, update on public.subscriptions from authenticated;
grant update (is_active) on public.subscriptions to authenticated;
