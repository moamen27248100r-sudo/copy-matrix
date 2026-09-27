"use client";

import type { ReactNode } from "react";

const DEPTH = 7; // px, real side thickness
const METAL = "linear-gradient(to right, #1e293b 0%, #cbd5e1 45%, #f8fafc 50%, #cbd5e1 55%, #1e293b 100%)";

// Clean, simple phone frame: a side-only 3D turn (rotateY + a touch of
// rotateZ, never rotateX -- a forward pitch reads as a distorted
// trapezoid instead of a phone), a thin titanium bezel with real
// side-panel thickness, and a Dynamic Island. Screen content is passed
// in as children so this file stays purely about the device shell.
export function PhoneFrame({
  children,
  extraRotateY,
  reducedMotion,
}: {
  children: ReactNode;
  extraRotateY: number;
  reducedMotion: boolean;
}) {
  return (
    <div className="relative" style={{ transformStyle: "preserve-3d" }}>
      <div
        className="transition-transform duration-300 ease-out"
        style={{ transform: `rotateY(${extraRotateY}deg)`, transformStyle: "preserve-3d" }}
      >
        <div
          className={reducedMotion ? "" : "showcase-float"}
          style={{
            transformStyle: "preserve-3d",
            transform: reducedMotion ? "rotateY(-14deg) rotateZ(2deg)" : undefined,
          }}
        >
          <div className="relative w-[240px] lg:w-[290px]" style={{ aspectRatio: "9 / 19.5", transformStyle: "preserve-3d" }}>
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: DEPTH, transformOrigin: "left center", transform: "rotateY(-90deg)", background: METAL }}
            >
              <span className="absolute start-1/2 top-[18%] h-6 w-full -translate-x-1/2 rounded-sm bg-slate-900/70" />
              <span className="absolute start-1/2 top-[30%] h-9 w-full -translate-x-1/2 rounded-sm bg-slate-900/70" />
              <span className="absolute start-1/2 top-[42%] h-9 w-full -translate-x-1/2 rounded-sm bg-slate-900/70" />
            </div>
            <div
              className="absolute inset-y-0 right-0"
              style={{ width: DEPTH, transformOrigin: "right center", transform: "rotateY(90deg)", background: METAL }}
            >
              <span className="absolute start-1/2 top-[24%] h-12 w-full -translate-x-1/2 rounded-sm bg-slate-900/70" />
            </div>

            <div className="absolute inset-0 rounded-[40px] p-[3px] lg:rounded-[46px]" style={{ background: METAL, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
              <div className="relative h-full w-full overflow-hidden rounded-[37px] border-[8px] border-black bg-[#0b0f17] lg:rounded-[43px] lg:border-[9px]">
                <span className="absolute inset-x-0 top-2.5 z-30 mx-auto block h-5 w-24 rounded-full bg-black lg:h-6 lg:w-28" />
                <div
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{ background: "linear-gradient(125deg, rgba(255,255,255,0.05) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.03) 100%)" }}
                />
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes showcaseFloat {
          0%, 100% { transform: rotateY(-12deg) rotateZ(2deg) translateY(0px); }
          50% { transform: rotateY(-16deg) rotateZ(2deg) translateY(6px); }
        }
        .showcase-float {
          animation: showcaseFloat 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
