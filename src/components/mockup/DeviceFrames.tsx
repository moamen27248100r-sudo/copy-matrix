import type { ReactNode } from "react";

// Device frames drawn in code (no images). Both are presentational and have no hooks, so the screen
// content passed in can be rendered on the server.

const TITANIUM = "linear-gradient(145deg, #3a4150 0%, #aab2c0 18%, #565d6b 42%, #2a2f3a 62%, #8d95a4 84%, #3a4150 100%)";

/**
 * A recent iPhone: titanium band, thin black bezel, dynamic island, side buttons, a home indicator,
 * a faint glass reflection and a layered, realistic shadow. The screen is 390 x 844 canvas units
 * scaled to the frame's width by <ScaledCanvas>; aspect ratio is 390:844.
 */
export function IPhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "390 / 844" }}>
      {/* side buttons */}
      <span className="absolute -start-[2.5px] top-[14.5%] h-[3.2%] w-[3px] rounded-s-sm bg-[#4a5160]" />
      <span className="absolute -start-[2.5px] top-[20.5%] h-[6%] w-[3px] rounded-s-sm bg-[#4a5160]" />
      <span className="absolute -start-[2.5px] top-[28.5%] h-[6%] w-[3px] rounded-s-sm bg-[#4a5160]" />
      <span className="absolute -end-[2.5px] top-[24%] h-[9.5%] w-[3px] rounded-e-sm bg-[#4a5160]" />

      <div
        className="absolute inset-0 rounded-[13.5%/6.2%] p-[1.1%]"
        style={{
          background: TITANIUM,
          boxShadow: "0 1px 1px rgba(255,255,255,0.25) inset, 0 30px 60px -18px rgba(0,0,0,0.65), 0 12px 24px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.5)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[12.4%/5.75%] bg-black p-[2.6%]">
          <div className="relative h-full w-full overflow-hidden rounded-[10.2%/4.7%] bg-[#0b0f17]">
            {children}
            {/* dynamic island */}
            <span className="absolute inset-x-0 top-[1.3%] z-30 mx-auto block h-[3.4%] w-[29%] rounded-full bg-black" />
            {/* home indicator */}
            <span className="absolute inset-x-0 bottom-[0.9%] z-30 mx-auto block h-[0.6%] w-[34%] rounded-full bg-white/70" />
            {/* glass reflection */}
            <span
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.04) 100%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A laptop: a thin aluminium lid around the screen (camera dot included) on a slim base with the
 * trackpad notch and a soft contact shadow. The screen is 1280 x 800 canvas units (16:10).
 */
export function LaptopFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="rounded-t-[1.6%/2.5%] p-[0.9%] pb-[0.7%]"
        style={{
          background: "linear-gradient(180deg, #4b5260 0%, #2c313b 100%)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.12) inset",
        }}
      >
        <div className="relative overflow-hidden rounded-[0.9%/1.4%] bg-black p-[0.55%]" style={{ aspectRatio: "16 / 10" }}>
          <div className="relative h-full w-full overflow-hidden rounded-[0.6%/1%] bg-[#0b0f17]">{children}</div>
          <span className="absolute left-1/2 top-[0.9%] z-20 block h-[0.9%] w-[0.9%] -translate-x-1/2 rounded-full bg-[#1a1e27]" />
        </div>
      </div>
      {/* base */}
      <div
        className="relative mx-auto h-[2.4%] min-h-[8px] w-[104%] -translate-x-[1.9%] rounded-b-[40%/90%]"
        style={{
          background: "linear-gradient(180deg, #8e96a5 0%, #5d6472 55%, #2a2f39 100%)",
          boxShadow: "0 22px 36px -14px rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.5)",
        }}
      >
        <span className="absolute left-1/2 top-0 block h-[48%] w-[14%] -translate-x-1/2 rounded-b-md bg-[#3b414d]" />
      </div>
    </div>
  );
}
