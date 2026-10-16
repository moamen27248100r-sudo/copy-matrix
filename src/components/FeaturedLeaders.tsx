"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";
import { initialsOf, badgeColors } from "@/lib/avatar-initials";
import { fmtReturn } from "@/lib/format-stats";

export type FeaturedLeader = {
  id: string;
  name: string;
  /** An uploaded photo, when the leader has one; otherwise the portrait is a gradient with their initials. */
  photoUrl: string | null;
  bio: string;
  /** Compounded return over the last 12 months, in percent. */
  roi12: number;
  copiers: number;
};

const ROTATE_MS = 4000;
const RESUME_AFTER_TOUCH_MS = 6000;

// "Suggested traders" as big portrait cards, one at a time with the next one peeking: a portrait (the
// leader's photo, or a gradient with their initials), the name with a verified mark, two lines of what
// they do, the 12-month return and the number of copiers, and one button to the profile. It turns
// by itself every 4 seconds, can be swiped, stops while it is touched, hovered or off screen, and does
// not move at all for visitors who asked their device for reduced motion.
export function FeaturedLeaders({ leaders, hrefBase = "/trader" }: { leaders: FeaturedLeader[]; hrefBase?: string }) {
  const t = useTranslations("Featured");
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef({ hover: false, touch: false, hidden: true, focus: false }); // hidden until the observer says it is on screen
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduced = useRef(false);

  const slides = useCallback(() => Array.from(trackRef.current?.children ?? []) as HTMLElement[], []);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const el = slides()[index];
      if (!track || !el) return;
      const rtl = getComputedStyle(track).direction === "rtl";
      const tr = track.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const delta = rtl ? er.right - tr.right : er.left - tr.left;
      track.scrollBy({ left: delta, behavior: reduced.current ? "auto" : "smooth" });
    },
    [slides],
  );

  // Which card is in front, read from where the track is scrolled to.
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const rtl = getComputedStyle(track).direction === "rtl";
    const tr = track.getBoundingClientRect();
    let best = 0;
    let bestDist = Infinity;
    slides().forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(rtl ? r.right - tr.right : r.left - tr.left);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  }, [slides]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || leaders.length < 2) return;
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(([entry]) => {
      pausedRef.current.hidden = !entry.isIntersecting;
    }, { threshold: 0.4 });
    observer.observe(track);
    const onVisibility = () => {
      pausedRef.current.hidden = document.hidden || pausedRef.current.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => {
      const p = pausedRef.current;
      if (p.hover || p.touch || p.hidden || p.focus || document.hidden) return;
      const el = trackRef.current;
      if (!el) return;
      const items = Array.from(el.children) as HTMLElement[];
      const rtl = getComputedStyle(el).direction === "rtl";
      const tr = el.getBoundingClientRect();
      let current = 0;
      let bestDist = Infinity;
      items.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(rtl ? r.right - tr.right : r.left - tr.left);
        if (d < bestDist) {
          bestDist = d;
          current = i;
        }
      });
      const next = (current + 1) % items.length;
      if (next === 0) el.scrollTo({ left: 0, behavior: "smooth" });
      else {
        const er = items[next].getBoundingClientRect();
        el.scrollBy({ left: rtl ? er.right - tr.right : er.left - tr.left, behavior: "smooth" });
      }
    }, ROTATE_MS);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(resumeTimer.current);
    };
  }, [leaders.length]);

  const touchStart = () => {
    pausedRef.current.touch = true;
    clearTimeout(resumeTimer.current);
  };
  const touchEnd = () => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current.touch = false;
    }, RESUME_AFTER_TOUCH_MS);
  };

  if (leaders.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t("regionLabel")}
      onMouseEnter={() => (pausedRef.current.hover = true)}
      onMouseLeave={() => (pausedRef.current.hover = false)}
      onFocus={() => (pausedRef.current.focus = true)}
      onBlur={() => (pausedRef.current.focus = false)}
      className="flex flex-col gap-3"
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={touchStart}
        onTouchEnd={touchEnd}
        onTouchCancel={touchEnd}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {leaders.map((l, i) => {
          const tone = badgeColors(l.id);
          const [a, b] = initialsOf(l.name);
          return (
            <div
              key={l.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${leaders.length}`}
              className="relative aspect-[3/4] w-[80%] max-w-[19rem] shrink-0 snap-start overflow-hidden rounded-[20px] border border-white/[0.08] sm:w-[19rem]"
              style={{ background: `linear-gradient(160deg, ${tone.from}, ${tone.to})` }}
            >
              {l.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photoUrl} alt="" width={304} height={405} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  translate="no"
                  className="absolute inset-x-0 top-[12%] flex justify-center text-[5.5rem] font-bold leading-none tracking-tight opacity-90"
                  style={{ color: tone.text }}
                >
                  {a}
                  {b && a !== b ? b : ""}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent" aria-hidden="true" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4">
                <h3 translate="no" className="flex items-center gap-1.5 text-xl font-bold leading-tight text-white">
                  <span className="min-w-0 break-words">{l.name}</span>
                  <BadgeCheck className="h-5 w-5 shrink-0 text-accent-text" aria-label={t("verified")} />
                </h3>
                <p dir="auto" className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-white/80">
                  {l.bio}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-black/35 px-2 py-1.5">
                    <dd className={`text-base font-bold tabular-nums ${l.roi12 < 0 ? "text-danger" : "text-success"}`}>
                      <bdi dir="ltr">{fmtReturn(l.roi12)}</bdi>
                    </dd>
                    <dt className="text-xs text-white/70">{t("return12m")}</dt>
                  </div>
                  <div className="rounded-xl bg-black/35 px-2 py-1.5">
                    <dd className="text-base font-bold tabular-nums text-white">
                      <bdi dir="ltr">{l.copiers.toLocaleString("en-US")}</bdi>
                    </dd>
                    <dt className="text-xs text-white/70">{t("copiers")}</dt>
                  </div>
                </dl>
                <Link
                  href={`${hrefBase}/${l.id}`}
                  className="mt-0.5 block rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-bold text-accent-foreground transition hover:bg-accent-hover"
                >
                  {t("viewProfile")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {leaders.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" role="group" aria-label={t("dotsLabel")}>
          {leaders.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t("goTo", { n: i + 1 })}
              aria-current={i === active ? "true" : undefined}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-accent" : "w-1.5 bg-white/30"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
