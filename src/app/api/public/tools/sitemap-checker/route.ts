// POST /api/public/tools/sitemap-checker — finds and checks a site's XML sitemaps (robots.txt Sitemap: lines,
// /sitemap.xml, /sitemap_index.xml; up to 10 child sitemaps, 50,000 URLs, 10 MB, ~17 s) plus a status check of up
// to 20 sample URLs. All fetching is SSRF-safe. 20/IP/hour (400/hour overall), no DB writes.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkPageToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { runSitemapCheck } from "@/lib/tools/sitemap-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOOL = "sitemap-checker";
const bodySchema = z.object({ url: z.string().max(2048) });

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const limit = checkPageToolLimit(TOOL, clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used this free tool 20 times this hour. Try again later, or use the Generator tab, which works without limits."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);
  const report = await runSitemapCheck(new URL(valid.url).origin);
  return json({ result: report }, { headers: { "Cache-Control": "no-store" } });
});
