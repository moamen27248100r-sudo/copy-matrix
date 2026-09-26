-- Critical bug found during a full-platform QA pass: stop_copy() has been
-- permanently blocking every customer from stopping a copy once more than
-- 10 minutes have passed since they started it -- which is effectively
-- always, in real usage. Reproduced live: a test subscription with ZERO
-- open positions was still rejected with "you have open trades" once its
-- copy_started_at was more than 10 minutes in the past.
--
-- History (via git blame equivalent, read from the migration files):
--   0092 (correct):  `if v_has_open_positions then raise ...`
--   0095 ("copy_start_grace_period"): added a grace-period clause meant to
--     stop customers from stopping a copy WITHIN their first 10 minutes:
--     `if v_has_open_positions or now() - v_copy_started_at < interval '10 minutes'`
--   0096 ("fix_grace_period_direction"): flipped `<` to `>=`, which
--     inverted the rule into "block once MORE than 10 minutes have
--     passed" -- a permanent lock with no way out, not a grace period.
--
-- The error message raised in both 0095 and 0096 only ever describes the
-- open-positions case ("لديك صفقات مفتوحة... أعد المحاولة بعد إغلاقها"),
-- never a grace-period reason, and start_or_update_copy() (0181) already
-- owns the real "can only edit within 10 minutes" grace-period rule for
-- amount edits. There's no sign the stop-copy-specific grace period was
-- ever a deliberate, separately-communicated rule -- so this restores the
-- original 0092 behavior instead of re-guessing a new time window: only
-- block stopping while the subscription still has an open position.
--
-- Live definition pulled via pg_get_functiondef() before editing (per
-- project convention); only the broken time condition is removed.
CREATE OR REPLACE FUNCTION public.stop_copy(p_provider_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_subscription_id uuid;
  v_has_open_positions boolean;
begin
  select id into v_subscription_id
  from public.subscriptions
  where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  if v_subscription_id is null then
    return;
  end if;

  select exists (
    select 1 from public.simulated_positions
    where subscription_id = v_subscription_id and status = 'open'
  ) into v_has_open_positions;

  if v_has_open_positions then
    raise exception 'تعذّر إيقاف النسخ حاليًا: لديك صفقات مفتوحة على هذا الحساب، ورصيدك محجوز حاليًا كهامش لتغطيتها. يُرجى إعادة المحاولة بعد إغلاق جميع الصفقات المفتوحة.';
  end if;

  update public.subscriptions set is_active = false where id = v_subscription_id;
end;
$function$;
