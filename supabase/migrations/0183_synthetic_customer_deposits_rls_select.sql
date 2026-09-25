-- 0182 created synthetic_customer_deposits with RLS enabled by the
-- schema's default but no policies, leaving it fully locked (silently
-- returns zero rows to every role instead of erroring, which is why this
-- was missed until a live browser check). Mirrors the exact SELECT-all
-- policies already on its sibling synthetic_customer_withdrawals /
-- synthetic_customer_pauses tables -- this data is public marketing
-- content (a leader's copiers list), not tied to any real user.

create policy synthetic_customer_deposits_select_all
  on public.synthetic_customer_deposits
  for select
  to authenticated
  using (true);

create policy synthetic_customer_deposits_select_public
  on public.synthetic_customer_deposits
  for select
  to anon
  using (true);
