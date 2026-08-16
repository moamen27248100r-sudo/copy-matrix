-- ============================================================
-- Copy Matrix — let visitors browse trader profiles (bio, stats,
-- full trade history) without an account, matching how real
-- copy-trading platforms handle discovery: browsing is public,
-- but copying/following requires signing up. provider_cards
-- already bypasses RLS (default view privileges), but the raw
-- signals table only allowed authenticated reads — add a public
-- read policy so the trade history / equity chart on a trader's
-- profile page render for guests too.
-- ============================================================

create policy "signals_select_public" on public.signals
  for select to anon
  using (true);
