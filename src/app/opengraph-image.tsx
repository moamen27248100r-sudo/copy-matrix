import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Open Graph image (1200x630): dark background matching globals.css
// `--background`, the site's logo mark (same double-chevron path used by
// icon.tsx / apple-icon.tsx / Logo.tsx), and the Arabic headline. The font
// is a subset of IBM Plex Sans Arabic Bold (same family the site uses)
// containing only the glyphs this headline needs, downloaded once into
// assets/ so ImageResponse doesn't depend on a runtime network fetch.
export const alt = "Copy Matrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const arabicBold = readFile(join(process.cwd(), "assets/ibm-plex-sans-arabic-bold-og.ttf"));

export default async function Image() {
  const fontData = await arabicBold;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#0b0f17",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -28 }}>
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
          <span style={{ color: "#ffffff", fontSize: 56, fontWeight: 700, marginLeft: 8 }}>Copy Matrix</span>
        </div>
        <div
          dir="rtl"
          style={{
            display: "flex",
            fontFamily: "IBM Plex Sans Arabic",
            fontSize: 54,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            maxWidth: 980,
          }}
        >
          انسخ صفقات أفضل المتداولين تلقائيًا
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "IBM Plex Sans Arabic", data: fontData, style: "normal", weight: 700 }],
    },
  );
}
