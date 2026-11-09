// POST /api/public/tools/ai-crawler-checker — "Is my site blocked from AI?": reads the site's robots.txt and homepage
// (SSRF-safe; 512 KB / 2 MB caps, 10 s each, in parallel) and reports AI crawler access plus page-level signals.
// 20/IP/hour (400/hour overall), no DB writes, no LLM calls.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkPageToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { safeFetch } from "@/lib/crawler/safe-fetch";
import { buildAiCrawlerReport } from "@/lib/tools/ai-crawlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOOL = "ai-crawler-checker";
const bodySchema = z.object({ url: z.string().max(2048) });

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const limit = checkPageToolLimit(TOOL, clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used this free tool 20 times this hour. Try again later, or start a free trial to monitor AI access every week."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);
  const site = new URL(valid.url).origin;
  const robotsUrl = `${site}/robots.txt`;

  const [robots, home] = await Promise.all([
    safeFetch(robotsUrl, { maxBytes: 512 * 1024, timeoutMs: 10_000 }).catch(() => null),
    safeFetch(`${site}/`, { maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000 }).catch(() => null),
  ]);
  if (!robots && !home) {
    throw new HttpError(422, "fetch_failed", "We couldn't connect to that website. It may be down or blocking visitors. Try again in a minute.");
  }
  const homeOk = home !== null && home.status >= 200 && home.status < 300;
  const report = buildAiCrawlerReport({
    robotsUrl,
    robotsText: robots ? robots.body : null,
    robotsStatus: robots ? robots.status : null,
    html: homeOk ? home.body : null,
    pageStatus: home ? home.status : null,
    xRobotsTag: home ? home.headers.get("x-robots-tag") : null,
  });
  return json({ result: { site, homeUrl: home?.finalUrl ?? `${site}/`, ...report } }, { headers: { "Cache-Control": "no-store" } });
});
