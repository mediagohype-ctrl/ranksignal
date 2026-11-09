// POST /api/public/tools/broken-link-checker — fetch ONE public page, then check every link and image on it.
// 5 runs per IP per hour (checkLinkToolLimit). The page fetch and every link target are SSRF-safe (assertPublicUrl on
// every hop). Up to 150 targets, 8 at a time, 3 per host, 6 s per request, and the whole run stops at ~25 s with
// partial results.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkLinkToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl } from "@/lib/free-check/validate";
import { fetchPublicHtml } from "@/lib/tools/fetch-page";
import { runLinkCheck } from "@/lib/tools/link-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Total time for the page fetch plus all link checks; leaves headroom under maxDuration. */
const BUDGET_MS = 25_000;

const bodySchema = z.object({ url: z.string().max(2048) });

export const POST = handler(async (req: Request) => {
  const started = Date.now();
  const body = await parseBody(req, bodySchema);
  // Cheap syntax check first so a typo doesn't use up one of the visitor's checks.
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a page address like example.com/about.");

  const limit = checkLinkToolLimit(clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used your free link checks for this hour. Try again later, or start a free trial to check your whole site."
        : "Lots of people are checking links right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const page = await fetchPublicHtml(body.url);
  const report = await runLinkCheck(page, { deadline: started + BUDGET_MS });
  return json({ report }, { headers: { "Cache-Control": "no-store" } });
});
