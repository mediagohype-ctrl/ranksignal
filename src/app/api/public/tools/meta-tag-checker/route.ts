// POST /api/public/tools/meta-tag-checker — free meta title & description checker for one public page.
// 20/IP/hour (400/hour overall), SSRF-safe fetch capped at 2 MB and 10 s, no DB writes, no LLM calls.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkPageToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl } from "@/lib/free-check/validate";
import { fetchPublicHtml } from "@/lib/tools/fetch-page";
import { analyzeMetaTags } from "@/lib/tools/meta-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOOL = "meta-tag-checker";
const bodySchema = z.object({ url: z.string().max(2048) });

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a page address like example.com/about.");

  const limit = checkPageToolLimit(TOOL, clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used this free tool 20 times this hour. Try again later, or start a free trial to check every page at once."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const page = await fetchPublicHtml(body.url);
  const report = analyzeMetaTags(page.html, page.finalUrl);
  return json(
    { result: { url: page.url, finalUrl: page.finalUrl, status: page.status, bytes: page.bytes, ...report } },
    { headers: { "Cache-Control": "no-store" } },
  );
});
