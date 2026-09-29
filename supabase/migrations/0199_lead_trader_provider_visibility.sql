-- Lead Trader Phase 2: let a self-service lead trader see their own
-- followers' subscription and position rows on their center dashboard.
-- Purely additive: two new SELECT policies. Postgres RLS policies are OR'd
-- together, so this only ever ADDS visibility for the narrow case of "this
-- row's provider belongs to me" -- it cannot reduce what anyone could already
-- see, and existing policies (subscriptions_select_own,
-- simulated_positions_select_own, the admin ones) are untouched.
CREATE POLICY subscriptions_select_provider ON public.subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = subscriptions.provider_id AND pr.user_id = auth.uid()));

CREATE POLICY simulated_positions_select_provider ON public.simulated_positions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.providers pr ON pr.id = s.provider_id
      WHERE s.id = simulated_positions.subscription_id AND pr.user_id = auth.uid()
    )
  );
