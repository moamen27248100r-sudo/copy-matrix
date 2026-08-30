-- ============================================================
-- Copy Matrix — 0058 sized every leader's base_followers_count off
-- their rating_score tier bucket. 0060 just corrected rating_score
-- itself (fixing the volatility-bonus-floors-at-zero and no-sample-
-- size-adjustment bugs), which moved 49 leaders out of "نخبة" alone
-- and shifted many more between tiers. Re-running the exact same
-- follower formula from 0058 now that provider_cards.rating_score
-- reflects the corrected, more realistic values — otherwise a leader
-- just demoted from نخبة to متوسط would still be sitting on a
-- follower count sized for an elite leader.
-- ============================================================

update public.providers p
set base_followers_count = greatest(
  3,
  least(
    round(t.tier_max * 1.15)::int,
    round(t.tier_min + (t.tier_max - t.tier_min) * t.tenure_norm * t.noise)::int
  )
)
from (
  select
    pc.provider_id,
    case
      when pc.rating_score >= 75 then 400
      when pc.rating_score >= 55 then 120
      when pc.rating_score >= 35 then 30
      else 5
    end as tier_min,
    case
      when pc.rating_score >= 75 then 2300
      when pc.rating_score >= 55 then 450
      when pc.rating_score >= 35 then 130
      else 40
    end as tier_max,
    least(1.0, extract(epoch from (now() - pc.joined_at)) / 86400 / 900.0) as tenure_norm,
    0.75 + random() * 0.5 as noise
  from public.provider_cards pc
) t
where p.id = t.provider_id;
