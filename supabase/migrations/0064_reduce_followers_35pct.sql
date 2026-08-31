-- ============================================================
-- Copy Matrix — reduces مستخدم ناسخ (total copy-user count) by 35%.
-- Scales base_followers_count itself (not just the homepage display)
-- so the reduction is real and consistent everywhere the number is
-- used — the homepage total, each leader's own "ناسخ" count on their
-- profile/discover card, and the derived متداول نشط ratio — instead
-- of only shrinking one aggregate stat while every individual
-- leader's follower count stays at the old, larger figure.
-- ============================================================

update public.providers
set base_followers_count = greatest(3, round(base_followers_count * 0.65));
