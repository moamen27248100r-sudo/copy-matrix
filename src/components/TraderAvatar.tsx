// Leader avatar: a clean circle with an optional level badge (off by default; pass showLevel) in the bottom
// corner. Uses the leader's own picture (providers.avatar_url -- an uploaded
// image or the seeded generated one) and falls back to the generated avatar
// for the id, so a leader is never shown as an empty circle.
//
// Plain <img> with explicit dimensions, lazy loading and async decoding. If
// the stored (possibly external) URL fails to load, it swaps to the generated
// same-origin avatar so the circle is never empty.
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { defaultAvatarUrl } from "@/lib/avatar-url";
import { leaderLevel } from "@/lib/leader-level";

const LEVEL_STYLES: Record<number, string> = {
  1: "bg-gradient-to-br from-slate-400 to-slate-600 text-white",
  2: "bg-gradient-to-br from-sky-400 to-blue-600 text-white",
  3: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white",
  4: "bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900",
  5: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white",
};


export function TraderAvatar({
  providerId,
  name,
  avatarUrl,
  ratingScore,
  size = 40,
  showLevel = false,
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
  const t = useTranslations("Common");
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
          title={t("level", { level: level ?? 0 })}
          aria-label={t("level", { level: level ?? 0 })}
          className={`absolute -bottom-1 -end-1 flex items-center justify-center rounded-full border-2 border-background font-bold leading-none shadow-md shadow-black/40 ${LEVEL_STYLES[level]}`}
          style={{ width: badge, height: badge, fontSize: Math.max(8, Math.round(badge * 0.55)) }}
        >
          {level}
        </span>
      )}
    </span>
  );
}
