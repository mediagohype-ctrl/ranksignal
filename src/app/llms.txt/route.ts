// GET /llms.txt — plain-text product summary for AI assistants (https://llmstxt.org).
import { buildLlmsTxt } from "@/lib/free-check/site-seo";

// Dynamic so the base URL comes from APP_URL at runtime, not at build time.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
