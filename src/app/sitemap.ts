import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/free-check/site-seo";

// Dynamic so URLs use APP_URL at runtime, not whatever was set at build time.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap();
}
