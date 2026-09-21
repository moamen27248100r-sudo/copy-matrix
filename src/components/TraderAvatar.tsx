// Leader avatar: a clean circle with an optional level badge in the bottom
// corner. Uses the leader's own picture (providers.avatar_url -- an uploaded
// image or the seeded generated one) and falls back to the generated avatar
// for the id, so a leader is never shown as an empty circle.
//
// Plain <img> with explicit dimensions, lazy loading and async decoding. If
// the stored (possibly external) URL fails to load, it swaps to the generated
// same-origin avatar so the circle is never empty.
"use client";

import { useEffect, useRef, useState } from "react";
import { defaultAvatarUrl } from "@/lib/avatar-svg";

const LEVEL_STYLES: Record<number, string> = {
  1: "bg-slate-500 text-white",
  2: "bg-accent text-white",
  3: "bg-success text-background",
  4: "bg-warning text-background",
  5: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white",
};

// rating_score is 0-100; 20 points per level.
export function leaderLevel(ratingScore: number | string | null | undefined): number | null {
  if (ratingScore == null) return null;
  const n = Number(ratingScore);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.ceil(n / 20)));
}

export function TraderAvatar({
  providerId,
  name,
  avatarUrl,
  ratingScore,
  size = 40,
  showLevel = true,
  priority = false,
  className = "",
}: {
  providerId: string;
  name?: string | null;
  avatarUrl?: string | null;
  ratingScore?: number | string | null;
  size?: number;
  showLevel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const level = showLevel ? leaderLevel(ratingScore) : null;
  const fallback = defaultAvatarUrl(providerId);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An error can fire before hydration attaches onError; catch that case here.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const badge = Math.max(14, Math.round(size * 0.4));

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={failed ? fallback : avatarUrl || fallback}
        onError={() => setFailed(true)}
        alt={name ?? ""}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full rounded-full bg-surface object-cover ring-1 ring-white/15"
      />
      {level != null && (
        <span
          title={`المستوى ${level}`}
          aria-label={`المستوى ${level}`}
          className={`absolute -bottom-0.5 -end-0.5 flex items-center justify-center rounded-full border-2 border-background font-bold leading-none ${LEVEL_STYLES[level]}`}
          style={{ width: badge, height: badge, fontSize: Math.max(8, Math.round(badge * 0.55)) }}
        >
          {level}
        </span>
      )}
    </span>
  );
}
