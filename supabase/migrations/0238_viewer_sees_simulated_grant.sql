-- provider_cards and the signals / providers / trader_posts policies call
-- viewer_sees_simulated() for every viewer, visitors included; functions are
-- not executable by default here (0225), so it needs an explicit grant.

grant execute on function public.viewer_sees_simulated() to anon, authenticated;
