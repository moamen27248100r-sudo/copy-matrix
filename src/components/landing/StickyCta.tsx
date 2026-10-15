"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Phone-only bottom button. Appears once the hero's own "start" button has scrolled out of view and
// hides again while the closing call-to-action is on screen (two identical buttons are never visible
// together).
export function StickyCta({ href, label, heroId, endId }: { href: string; label: string; heroId: string; endId: string }) {
  const [pastHero, setPastHero] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const end = document.getElementById(endId);
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const heroObs = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0));
    heroObs.observe(hero);
    const endObs = new IntersectionObserver(([e]) => setAtEnd(e.isIntersecting));
    if (end) endObs.observe(end);
    return () => {
      heroObs.disconnect();
      endObs.disconnect();
    };
  }, [heroId, endId]);

  const visible = pastHero && !atEnd;
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={href}
        tabIndex={visible ? 0 : -1}
        className="block w-full rounded bg-accent py-3 text-center font-medium text-accent-foreground transition hover:bg-accent-hover"
      >
        {label}
      </Link>
    </div>
  );
}
