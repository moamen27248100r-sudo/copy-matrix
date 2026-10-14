import { ImageResponse } from "next/og";

// The app icon at any size the manifest, the home screen and the push notifications need:
// /pwa-icon/192, /pwa-icon/512?maskable=1 ... Same mark and colours as icon.tsx / apple-icon.tsx.
// "maskable" keeps the mark inside the safe zone so Android can crop it to any shape.
const SIZES = [48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!SIZES.includes(size)) return new Response("not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const mark = Math.round(size * (maskable ? 0.46 : 0.6));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          borderRadius: maskable ? 0 : Math.round(size * 0.2),
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19l3-5 3 3 5-9" />
          <path d="M12 8h4v4" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
