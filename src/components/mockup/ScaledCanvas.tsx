"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Real screens are built once on a fixed canvas (a phone 390 x 844, a laptop 1280 x 800, in their own
// CSS pixels, with their native font sizes) and this wrapper scales the whole canvas to the width of
// the frame it sits in. Text and spacing stay in the same proportions at every size and stay sharp
// (it is vector rendering, not a scaled picture). Nothing inside can be reached: it is inert, hidden
// from assistive technology and ignores the pointer -- it is an illustration, not an interface.
export function ScaledCanvas({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        inert
        className="pointer-events-none select-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          transform: `scale(${scale ?? 0.3})`,
          transformOrigin: "top left",
          visibility: scale == null ? "hidden" : "visible",
        }}
      >
        {children}
      </div>
    </div>
  );
}
