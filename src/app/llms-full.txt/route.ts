// GET /llms-full.txt — product summary plus the full text of every guide, for AI assistants.
import { buildLlmsFullTxt } from "@/lib/free-check/site-seo";

// Dynamic so the base URL comes from APP_URL at runtime, not at build time.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(buildLlmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
