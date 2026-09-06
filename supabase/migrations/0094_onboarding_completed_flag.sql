-- account_type defaults to 'demo' for every new profile (0015), so it can't
-- tell "never actively chosen yet" apart from "explicitly confirmed demo".
-- A dedicated flag lets /onboarding/account-type refuse to render a second
-- time (e.g. after a browser back-navigation once the step is already
-- done), instead of silently offering to re-run chooseAccountType and reset
-- the balance/subscriptions again.
alter table public.profiles add column onboarding_completed boolean not null default false;

-- Every profile that already exists got here by finishing (or being seeded
-- past) this step already.
update public.profiles set onboarding_completed = true;
