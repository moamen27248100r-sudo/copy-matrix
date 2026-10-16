"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { FeaturedLeader } from "@/components/FeaturedLeaders";

// The carousel is not part of the first screen's work: its code is a separate chunk, fetched and run
// only once its place is about to come into view. Until then (and while the chunk loads) a box of
// exactly the same size holds the place, so nothing moves when it arrives.
function Placeholder() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
        <div className="aspect-[3/4] w-[80%] max-w-[19rem] shrink-0 rounded-[20px] border border-white/[0.08] bg-surface sm:w-[19rem]" />
      </div>
      <div className="h-6" />
    </div>
  );
}

const Carousel = dynamic(() => import("@/components/FeaturedLeaders").then((m) => m.FeaturedLeaders), { ssr: false, loading: () => <Placeholder /> });

export function FeaturedLeadersLazy({ leaders }: { leaders: FeaturedLeader[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return <div ref={ref}>{near ? <Carousel leaders={leaders} /> : <Placeholder />}</div>;
}
