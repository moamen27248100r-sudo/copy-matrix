import Image from "next/image";

// Flat phone frame: rounded corners, thin border, Dynamic Island; no tilt, no
// shadow. Shows a video (autoplay, muted, loop) with the image as poster when a
// videoSrc is given, otherwise just the image.
export function PhoneFrame({
  src,
  alt,
  width = 260,
  priority = false,
  sizes,
  videoSrc,
  className = "",
  crop = false,
}: {
  src: string;
  alt: string;
  width?: number;
  priority?: boolean;
  sizes?: string;
  videoSrc?: string | null;
  className?: string;
  /** Show only the upper part of the screenshot (used for the small "how it works" phones). */
  crop?: boolean;
}) {
  const radius = Math.round(width * 0.13);
  return (
    <div
      className={`relative shrink-0 border border-border-strong bg-background ${className}`}
      style={{ width, borderRadius: radius, padding: 6 }}
    >
      <div
        className="relative flex flex-col overflow-hidden bg-background"
        style={{ borderRadius: radius - 6, aspectRatio: crop ? "390 / 560" : "390 / 844" }}
      >
        {/* Empty strip so the Dynamic Island never covers the app header. */}
        <span aria-hidden="true" className="block shrink-0" style={{ height: width * 0.115 }} />
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black"
          style={{ top: width * 0.03, width: width * 0.28, height: width * 0.065 }}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {videoSrc ? (
            <video autoPlay muted loop playsInline poster={src} className="h-full w-full object-cover object-top">
              <source src={videoSrc} type="video/mp4" />
            </video>
          ) : (
            <Image
              src={src}
              alt={alt}
              width={780}
              height={1688}
              sizes={sizes ?? `${width}px`}
              priority={priority}
              className="h-full w-full object-cover object-top"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Minimal browser window: three dots and an address field above the screenshot.
export function BrowserFrame({
  src,
  alt,
  priority = false,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border-strong bg-surface ${className}`}>
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5" dir="ltr">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="mx-auto w-full max-w-[280px] truncate rounded-lg bg-background px-3 py-1 text-center text-xs text-muted">
          copy-matrix.com
        </span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      <Image src={src} alt={alt} width={1800} height={1125} sizes={sizes ?? "(min-width: 1024px) 560px, 100vw"} priority={priority} className="h-auto w-full" />
    </div>
  );
}
