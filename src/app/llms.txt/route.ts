// GET /llms.txt — plain-text product summary for AI assistants (https://llmstxt.org), incl. published blog posts.
import { blogRoutes, buildLlmsTxt } from "@/lib/free-check/site-seo";
import { publishedPosts } from "@/lib/content/posts";

// Dynamic so the base URL comes from APP_URL at runtime, not at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(buildLlmsTxt(undefined, blogRoutes(await publishedPosts())), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
