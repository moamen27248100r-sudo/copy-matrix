"use client";

import type { ReactNode } from "react";
import { useElementWidth } from "./hooks";

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = Math.round((CANVAS_WIDTH * 19.5) / 9);

// Every screen is built once, at a fixed real-iPhone-width canvas (390px)
// with normal, native-looking font sizes -- then this wrapper measures
// its own rendered width (whatever the current phone size actually is,
// via ResizeObserver) and scales the whole canvas down to fit. That way
// text and spacing stay proportionally identical at 220px, 250px and
// 280px instead of needing separate hand-tuned sizes per breakpoint.
export function ScaledScreenContent({ children }: { children: ReactNode }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const scale = width > 0 ? width / CANVAS_WIDTH : 1;

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
