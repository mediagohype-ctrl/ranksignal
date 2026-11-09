// GET /blog/rss.xml — RSS 2.0 feed of published posts (feed readers, aggregators and some AI crawlers use it).
import { BRAND } from "@/lib/brand";
import { publishedPosts } from "@/lib/content/posts";
import { siteBase } from "@/lib/free-check/site-seo";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const base = siteBase();
  const posts = await publishedPosts({ take: 50 });
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${base}/blog/${p.slug}</link>
      <guid isPermaLink="true">${base}/blog/${p.slug}</guid>
      <description>${esc(p.description)}</description>
      <category>${esc(p.category)}</category>
      <dc:creator>${esc(p.authorName)}</dc:creator>
      <pubDate>${(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(BRAND.name)} blog</title>
    <link>${base}/blog</link>
    <description>${esc("SEO, AEO and GEO news, research and how-tos.")}</description>
    <language>en-in</language>
    <atom:link href="${base}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
