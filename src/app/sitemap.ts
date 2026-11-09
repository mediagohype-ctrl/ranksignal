import type { MetadataRoute } from "next";
import { blogRoutes, buildSitemap } from "@/lib/free-check/site-seo";
import { publishedPosts } from "@/lib/content/posts";

// Dynamic so URLs use APP_URL at runtime and newly published blog posts appear immediately.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(undefined, undefined, blogRoutes(await publishedPosts()));
}
