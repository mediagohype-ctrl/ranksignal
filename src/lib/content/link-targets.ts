// Pages a blog writer can link to from the post editor's "Link to our page" picker: main pages, free tools,
// Learn guides and published blog posts. Server-only (reads the database).
import { db } from "@/lib/db";
import { PAGE_SEO } from "@/lib/seo/pages";
import { ARTICLES } from "@/lib/learn/articles";

export interface LinkTarget {
  group: "Main pages" | "Free tools" | "Guides" | "Blog posts";
  title: string;
  path: string;
}

/** Short page name from an SEO title ("Pricing: Plans for … " → "Pricing"). */
const shortTitle = (t: string) => t.split(/\s[|·–—:]\s|:\s/)[0]!.trim();

export async function linkTargets(excludePostId?: string): Promise<LinkTarget[]> {
  const pages: LinkTarget[] = Object.entries(PAGE_SEO)
    .filter(([path, seo]) => !("noindex" in seo && seo.noindex) && !path.startsWith("/hi") && !path.startsWith("/docs"))
    .filter(([path]) => !["/privacy", "/terms", "/tools/seo-extension"].includes(path))
    .map(([path, seo]) => ({
      group: path.startsWith("/tools/") ? "Free tools" : "Main pages",
      title: path === "/" ? "Home page" : shortTitle(seo.title),
      path,
    }));
  const guides: LinkTarget[] = ARTICLES.map((a) => ({ group: "Guides", title: a.title, path: `/learn/${a.slug}` }));
  const posts = await db.blogPost
    .findMany({
      where: { status: "published", ...(excludePostId ? { id: { not: excludePostId } } : {}) },
      select: { slug: true, title: true },
      orderBy: { publishedAt: "desc" },
      take: 200,
    })
    .catch(() => []);
  return [...pages, ...guides, ...posts.map((p) => ({ group: "Blog posts" as const, title: p.title, path: `/blog/${p.slug}` }))];
}
