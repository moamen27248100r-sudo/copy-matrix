"use client";

import type { ReactNode } from "react";

const METAL = "linear-gradient(to right, #1e293b 0%, #cbd5e1 45%, #f8fafc 50%, #cbd5e1 55%, #1e293b 100%)";

// Flat, 2D-only phone shell -- no perspective/preserve-3d/rotateY. Those
// rendered as visibly separate hairline layers on Safari/iOS instead of
// a solid edge, which is exactly the "خطوط منفصلة" bug this replaces.
// Depth is suggested with a thin titanium border + flat side buttons
// (plain absolutely-positioned 3px bars, no 3D fold) and a soft shadow;
// the only rotation left is a plain 2D `rotate()` the caller supplies
// via className (e.g. "lg:rotate-[-4deg]" for the front phone on
// desktop, "rotate-[6deg]" for the smaller back phone).
export function PhoneFrame({
  children,
  widthClassName,
  rotateClassName = "",
  opacityClassName = "",
}: {
  children: ReactNode;
  widthClassName: string;
  rotateClassName?: string;
  opacityClassName?: string;
}) {
  return (
    <div
      className={`relative ${widthClassName} ${rotateClassName} ${opacityClassName}`}
      style={{ aspectRatio: "9 / 19.5" }}
    >
      <span className="absolute -start-[3px] top-[16%] h-6 w-[3px] rounded-s-sm bg-slate-700" />
      <span className="absolute -start-[3px] top-[26%] h-9 w-[3px] rounded-s-sm bg-slate-700" />
      <span className="absolute -start-[3px] top-[36%] h-9 w-[3px] rounded-s-sm bg-slate-700" />
      <span className="absolute -end-[3px] top-[22%] h-12 w-[3px] rounded-e-sm bg-slate-700" />

      <div
        className="absolute inset-0 rounded-[44px] p-[3px]"
        style={{ background: METAL, boxShadow: "0 20px 45px -10px rgba(0,0,0,0.55)" }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[41px] border-[8px] border-black bg-[#0b0f17]">
          <span className="absolute inset-x-0 top-2.5 z-30 mx-auto block h-5 w-24 rounded-full bg-black" />
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{ background: "linear-gradient(125deg, rgba(255,255,255,0.05) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.03) 100%)" }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
