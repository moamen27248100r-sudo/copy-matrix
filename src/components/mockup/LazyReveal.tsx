"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A section below the fold: its content is not mounted until the visitor is about to reach it
// (so the page is not slowed down by screens nobody has scrolled to), and it fades / rises in once
// it is on screen. The placeholder has the final aspect ratio, so nothing jumps. With reduced motion
// it simply appears.
export function LazyReveal({ children, aspect, className = "" }: { children: ReactNode; aspect: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => {
        setMounted(true);
        setShown(true);
      }, 0);
      return () => clearTimeout(id);
    }
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMounted(true);
          near.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    const visible = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          visible.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    near.observe(el);
    visible.observe(el);
    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ aspectRatio: aspect }}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"} ${className}`}
    >
      {mounted ? children : null}
    </div>
  );
}
