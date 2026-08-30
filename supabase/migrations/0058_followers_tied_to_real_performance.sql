-- ============================================================
-- Copy Matrix — follower counts were set by whichever generator
-- batch created that leader (five different formulas across
-- migrations 0043-0053), and never revisited after 0055 rewrote
-- everyone's actual performance. The result: a leader with an 18%
-- win rate and a rating_score of 0 had 630 followers, while a leader
-- with a 92% win rate and a rating_score of 83 had 11 — completely
-- disconnected from how good anyone actually is.
--
-- Recomputes base_followers_count for every leader from ONE
-- consistent formula: a follower tier from their real, currently-
-- computed rating_score (itself derived from real win rate, real
-- avg return, and real volatility — already live in provider_cards),
-- placed within that tier by real tenure (older + still that good =
-- more accumulated followers), plus a little noise for natural
-- variation. Struggling/low-rated leaders land small on their own —
-- no special-casing needed, the real rating already penalizes them.
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
