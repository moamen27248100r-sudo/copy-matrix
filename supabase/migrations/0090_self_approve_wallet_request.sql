-- Deposits/withdrawals are now processed instantly instead of waiting on
-- manual admin review. wallet_requests only allows admins to UPDATE
-- (wallet_requests_update_admin), so a client can't self-approve via a
-- plain .update() — this security-definer function lets a user approve
-- ONLY their own pending request, nothing else, and the existing
-- apply_wallet_request() trigger (balance crediting, insufficient-balance
-- check on withdrawals) still fires exactly as before since it's a trigger
-- on the table, independent of how the UPDATE was issued.
create function public.self_approve_wallet_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallet_requests
  set status = 'approved'
  where id = p_request_id
    and user_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'تعذّر إتمام الطلب.';
  end if;
end;
$$;

grant execute on function public.self_approve_wallet_request(uuid) to authenticated;
