// POST /api/public/free-check — anonymous AI-readiness check (lead magnet).
// Captcha + 3/IP/hour + 30/hour global, SSRF-safe fetching, ~25s budget, no LLM calls.
// The only DB write is a best-effort Lead row for the admin CRM (url, score, hashed IP). Its id is returned so the
// visitor can add their email (POST /api/public/free-check/email); the insert waits at most ~1.5s and never fails the check.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { checkFreeCheckLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { FreeCheckError, runFreeCheck } from "@/lib/free-check/run";
import { recordLead } from "@/lib/admin/leads";
import { topFixMessage } from "@/lib/admin/lead-followup";
import { setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Longest we wait for the best-effort Lead insert before answering without a lead id. */
const LEAD_WAIT_MS = 1_500;

const bodySchema = z.object({
  url: z.string().max(2048),
  turnstileToken: z.string().max(4096).optional(),
});

export const POST = handler(withToolUsage("free-check", async (req: Request) => {
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

  setToolUsage({ url: body.url.trim() });
  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);

  try {
    const item = await runFreeCheck(valid.url);
    const leadId = await Promise.race([
      recordLead({ source: "free_check", url: item.url, score: item.overall.score, message: topFixMessage(item.issues[0]?.title), ip }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LEAD_WAIT_MS)),
    ]);
    setToolUsage({ url: item.url, score: item.overall.score, leadId });
    return json({ item: { ...item, leadId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FreeCheckError) throw new HttpError(e.code === "blocked_url" ? 400 : 422, e.code, e.message);
    throw e;
  }
}));
