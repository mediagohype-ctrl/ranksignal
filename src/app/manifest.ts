import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4338ca",
    icons: [
      { src: "/brand/logo-mark-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/logo-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
