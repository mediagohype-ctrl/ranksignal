// POST /api/public/free-check — anonymous AI-readiness check (lead magnet).
// Captcha + 3/IP/hour + 30/hour global, SSRF-safe fetching, ~25s budget, no LLM calls.
// The only DB write is a best-effort Lead row for the admin CRM (url, score, hashed IP) that never blocks the response.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { checkFreeCheckLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { FreeCheckError, runFreeCheck } from "@/lib/free-check/run";
import { recordLeadInBackground } from "@/lib/admin/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().max(2048),
  turnstileToken: z.string().max(4096).optional(),
});

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  // Cheap syntax check first so a typo doesn't use up one of the visitor's checks.
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const ip = clientIp(req);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "The security check failed. Please try again.");
  }
  const limit = checkFreeCheckLimit(ip);
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used your free checks for this hour. Start a free trial for the full report, or try again later."
        : "Lots of people are running checks right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);

  try {
    const item = await runFreeCheck(valid.url);
    recordLeadInBackground({ source: "free_check", url: item.url, score: item.overall.score, ip });
    return json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FreeCheckError) throw new HttpError(e.code === "blocked_url" ? 400 : 422, e.code, e.message);
    throw e;
  }
});
