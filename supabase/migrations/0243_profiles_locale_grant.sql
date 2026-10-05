-- Customers set their own language (profiles.locale, 0242) when they switch
-- language in the app; only that column, like the other self-service ones.

grant update (locale) on public.profiles to authenticated;
