-- Lead Trader Phase 4 (whitelist decision, approved by the owner): gate new
-- copies of a whitelist-enabled lead trader behind an accepted invite, at
-- BOTH layers -- the UI (discover/actions.ts followProvider, checked before
-- calling this RPC) and here, inside start_or_update_copy() itself, so a
-- direct API call can't bypass it either.
--
-- Live definition captured via pg_get_functiondef() first and saved to
-- supabase/rollback/start_or_update_copy.sql before this change, per the
-- owner's condition. The only change from that snapshot is one new `if`
-- block (marked below) inserted right after v_is_starting is computed;
-- every other line, in the same order, is untouched. It only ever affects
-- a NEW copy (v_is_starting) of a provider that has
-- lead_trader_profiles.whitelist_enabled = true -- every other provider,
-- and every existing follower topping up their own already-active copy,
-- behaves exactly as before.
CREATE OR REPLACE FUNCTION public.start_or_update_copy(p_provider_id uuid, p_allocated_amount numeric)
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

  -- >>> new block: whitelist gate (Phase 4) <<<
  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.whitelist_enabled
  ) and not exists (
    select 1 from public.follower_invites fi
    where fi.provider_id = p_provider_id and fi.used_by = auth.uid()
  ) then
    raise exception 'not_invited' using errcode = 'CM008';
  end if;
  -- >>> end new block <<<

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

  insert into public.subscriptions (follower_id, provider_id, is_active, allocated_amount, max_drawdown_pct, copy_started_at)
  values (auth.uid(), p_provider_id, true, p_allocated_amount, 50, v_new_started_at)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = 50,
        copy_started_at = v_new_started_at;
end;
$function$;
