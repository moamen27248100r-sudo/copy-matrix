import type { MetadataRoute } from "next";

// PWA manifest ("add to home screen"): the platform name and colours, a splash in the platform
// colour (background_color + the icon), standalone / full-screen display and the icon at every
// size (rendered by app/pwa-icon/[size]).
const SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Copy Matrix",
    short_name: "Copy Matrix",
    description: "Copy trading platform",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#0b0f17",
    theme_color: "#0b1726",
    categories: ["finance"],
    icons: [
      ...SIZES.map((s) => ({ src: `/pwa-icon/${s}`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const })),
      { src: "/pwa-icon/192?maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" as const },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
    ],
  };
}
