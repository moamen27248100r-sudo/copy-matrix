-- ============================================================
-- Copy Matrix — establish a realistic founding timeline (2024)
-- and scale follower counts down to believable levels. Leader
-- and account join dates now spread randomly across 2024-01-01
-- through today instead of clustering near "now", and the
-- ongoing cron-driven simulation continues the story forward
-- from today at a gradual pace.
-- ============================================================

update public.providers
set
  base_followers_count = (5 + floor(random() * 295))::int,
  created_at = timestamp '2024-01-01' + random() * (now() - timestamp '2024-01-01')
where user_id is null;

update public.profiles
set created_at = timestamp '2024-01-01' + random() * (now() - timestamp '2024-01-01');
