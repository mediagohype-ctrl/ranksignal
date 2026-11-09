// POST /api/public/tools/robots-txt-tester — fetches a site's /robots.txt (SSRF-safe, 600 KB, 10 s, 5 redirects) and
// returns its text and HTTP result. The lint and Allowed/Blocked tests run in the browser (src/lib/tools/robots-tester.ts),
// so pasted robots.txt text never needs the network. 20/IP/hour (400/hour overall), no DB writes.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkPageToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { ROBOTS_INPUT_MAX_CHARS, type RobotsFetchResult } from "@/lib/tools/robots-tester";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOOL = "robots-txt-tester";
const bodySchema = z.object({ url: z.string().max(2048) });

function fetchError(e: unknown): string {
  if (e instanceof SafeFetchError) {
    if (e.code === "timeout") return "Your robots.txt took longer than 10 seconds to load.";
    if (e.code === "too_large") return "Your robots.txt is larger than 600 KB. Google only reads the first 500 KB.";
    if (e.code === "too_many_redirects") return "Your robots.txt redirects more than 5 times.";
    if (e.code === "blocked") return "Your robots.txt redirects to an address that isn't a public website.";
  }
  return "We couldn't connect to your website. It may be down or blocking visitors.";
}

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const limit = checkPageToolLimit(TOOL, clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used this free tool 20 times this hour. Paste your robots.txt text instead, or try again later."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);
  const site = new URL(valid.url).origin;
  const robotsUrl = `${site}/robots.txt`;

  const result: RobotsFetchResult = { site, robotsUrl, finalUrl: null, status: null, redirectChain: [], contentType: null, text: null, error: null };
  try {
    const res = await safeFetch(robotsUrl, { maxBytes: ROBOTS_INPUT_MAX_CHARS, timeoutMs: 10_000, maxRedirects: 5 });
    result.finalUrl = res.finalUrl;
    result.status = res.status;
    result.redirectChain = res.redirectChain;
    result.contentType = res.headers.get("content-type");
    if (res.status >= 200 && res.status < 300) {
      // An HTML page served at /robots.txt (common on some hosts) is not a robots.txt file.
      const html = /^\s*<(!doctype html|html)\b/i.test(res.body);
      result.text = html ? "" : res.body;
      if (html) result.error = "Your server returned a web page instead of a robots.txt file. Crawlers will find no rules in it.";
    }
  } catch (e) {
    result.error = fetchError(e);
  }
  return json({ result }, { headers: { "Cache-Control": "no-store" } });
});
