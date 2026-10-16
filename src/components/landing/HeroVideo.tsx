"use client";

import { useEffect, useRef, useState } from "react";

// The hero's film. The poster is a plain image and paints with the page; the video itself is only
// requested after the page has loaded (so it never competes with the text or the poster), plays
// muted in a loop, and pauses while it is off screen. With reduced motion only the poster shows.
export function HeroVideo({ lang }: { lang: "ar" | "en" }) {
  const box = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<{ webm: string; mp4: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const base = `/video/hero-${lang}`;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    let cancelled = false;
    const start = () => {
      if (cancelled || reduce.matches) return;
      const kind = window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
      setSrc({ webm: `${base}-${kind}.webm`, mp4: `${base}-${kind}.mp4` });
    };
    const later = () => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 300));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    const onChange = () => {
      if (reduce.matches) {
        setSrc(null);
        setPlaying(false);
      }
    };
    reduce.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("load", later);
      reduce.removeEventListener("change", onChange);
    };
  }, [base]);

  useEffect(() => {
    const el = box.current;
    const video = el?.querySelector("video");
    if (!el || !video) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <div ref={box} className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#06080c] md:aspect-video">
      <picture>
        <source media="(min-width: 768px)" srcSet={`${base}-desktop.jpg`} width={1920} height={1080} />
        <img
          src={`${base}-mobile.jpg`}
          width={1080}
          height={1350}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      {src && (
        <video
          key={src.mp4}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
        >
          <source src={src.webm} type="video/webm" />
          <source src={src.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
