import { ImageResponse } from "next/og";

// PWA install icon (192x192), served as a static-looking asset for
// src/app/manifest.ts. Same mark/colors as icon.tsx / apple-icon.tsx, just
// rendered at a larger size for home-screen icons.

export async function GET() {
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
        }}
      >
        <svg
          width="118"
          height="118"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2f6fed"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 19l3-5 3 3 5-9" />
          <path d="M12 8h4v4" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
