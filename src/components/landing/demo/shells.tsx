import type { ReactNode } from "react";

// Flat device frames (no tilt, no shadow). Screens are React components drawn on a
// fixed 375px-wide canvas and scaled to the frame width, so they look exactly like
// the app at phone size.

const CANVAS_W = 375;
const CANVAS_H = 812;

export function PhoneShell({ children, width = 280, className = "", label }: { children: ReactNode; width?: number; className?: string; label?: string }) {
  const inner = width - 12;
  const scale = inner / CANVAS_W;
  const radius = Math.round(width * 0.13);
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={`relative shrink-0 border border-border-strong bg-background ${className}`}
      style={{ width, borderRadius: radius, padding: 6 }}
    >
      <div className="relative overflow-hidden bg-background" style={{ width: inner, height: CANVAS_H * scale, borderRadius: radius - 6 }}>
        <div aria-hidden="true" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black"
          style={{ top: width * 0.03, width: width * 0.28, height: width * 0.065 }}
        />
      </div>
    </div>
  );
}

const BROWSER_CANVAS_W = 640;
const BROWSER_CANVAS_H = 380;

export function BrowserShell({
  children,
  className = "",
  width = BROWSER_CANVAS_W,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  const scale = width / BROWSER_CANVAS_W;
  return (
    <div className={`overflow-hidden rounded-2xl border border-border-strong bg-background ${className}`} style={{ width }}>
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5" dir="ltr">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="mx-auto w-full max-w-[260px] truncate rounded-lg bg-background px-3 py-1 text-center text-xs text-muted">copy-matrix.com</span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      <div style={{ height: BROWSER_CANVAS_H * scale, overflow: "hidden" }}>
        <div aria-hidden="true" style={{ width: BROWSER_CANVAS_W, height: BROWSER_CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
