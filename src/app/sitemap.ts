import type { MetadataRoute } from "next";
import { blogRoutes, buildSitemap } from "@/lib/free-check/site-seo";
import { publishedPosts } from "@/lib/content/posts";

// Dynamic so URLs use APP_URL at runtime and newly published blog posts appear immediately.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await publishedPosts({ take: 5000 });
  const entries = buildSitemap(undefined, undefined, blogRoutes(posts));
  // The /blog index changes whenever a post does: give it the newest post's date.
  const newest = posts.reduce<Date | null>((d, p) => (!d || p.updatedAt > d ? p.updatedAt : d), null);
  if (newest) {
    const blog = entries.find((e) => e.url.endsWith("/blog"));
    if (blog && (!blog.lastModified || newest > new Date(blog.lastModified))) blog.lastModified = newest;
  }
  return entries;
}
