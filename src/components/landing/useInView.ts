"use client";

import { useEffect, useRef, useState } from "react";

// True once the element has scrolled into view (and stays true). With
// prefers-reduced-motion it is true immediately, so animations are skipped.
export function useInView<T extends HTMLElement>(margin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(isReduced);
    const el = ref.current;
    if (!el || isReduced) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, inView, reduced };
}
