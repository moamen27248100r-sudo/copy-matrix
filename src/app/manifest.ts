import type { MetadataRoute } from "next";

// PWA manifest for "add to home screen". Reuses the same background color as
// globals.css `:root { --background }` and the same logo mark as icon.tsx /
// apple-icon.tsx (rendered at 192x192 / 512x512 by icon-192.tsx / icon-512.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Copy Matrix",
    short_name: "CopyMatrix",
    display: "standalone",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
