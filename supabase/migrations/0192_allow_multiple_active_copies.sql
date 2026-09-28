-- Dashboard redesign: customers can now copy multiple traders at the same
-- time instead of being limited to one active subscription. Removes the
-- "already_copying_other" (CM005) guard from start_or_update_copy() that
-- blocked starting a second copy while one was active.
--
-- Correctness fix that comes with lifting that limit: the exceeds_balance
-- (CM006) check previously compared the new allocation against the
-- customer's whole balance, which was fine when only one subscription could
-- ever be active. With several active subscriptions it must instead compare
-- against the balance still unallocated by the customer's *other* active
-- copies, so the sum of all simultaneous allocations can never exceed the
-- account balance.
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
