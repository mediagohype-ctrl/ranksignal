// GET /llms-full.txt — product summary plus the full text of every guide and published blog post, for AI assistants.
import { buildLlmsFullTxt, siteBase } from "@/lib/free-check/site-seo";
import { postToMarkdown, publishedPosts } from "@/lib/content/posts";

// Dynamic so the base URL comes from APP_URL at runtime, not at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const base = siteBase();
  const posts = await publishedPosts({ take: 100 });
  return new Response(buildLlmsFullTxt(base, posts.map((p) => postToMarkdown(p, base))), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
