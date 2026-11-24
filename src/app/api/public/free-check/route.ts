// POST /api/public/free-check — anonymous AI-readiness check (lead magnet).
// Captcha + 10/IP/hour + 60/hour global (failed checks are refunded; the same site within 24 hours comes from the
// cache and doesn't count), SSRF-safe fetching, ~27s budget, no LLM calls.
// The only DB write is a best-effort Lead row for the admin CRM (url, score, hashed IP). Its id is returned so the
// visitor can add their email (POST /api/public/free-check/email); the insert waits at most ~1.5s and never fails the check.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { checkFreeCheckLimit, refundFreeCheck } from "@/lib/free-check/limits";
import { getCachedFreeCheck, setCachedFreeCheck } from "@/lib/free-check/cache";
import { attributionSchema } from "@/lib/attribution";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { FreeCheckError, runFreeCheck } from "@/lib/free-check/run";
import { recordLead } from "@/lib/admin/leads";
import { topFixMessage } from "@/lib/admin/lead-followup";
import { setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";
import { freeCheckBenchmark } from "@/lib/free-check/benchmark";
import { metaVisitor, trackMeta } from "@/lib/meta/capi";
import type { FreeCheckResult } from "@/lib/free-check/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Longest we wait for the best-effort Lead insert before answering without a lead id. */
const LEAD_WAIT_MS = 1_500;

const bodySchema = z.object({
  url: z.string().max(2048),
  turnstileToken: z.string().max(4096).optional(),
  attribution: attributionSchema,
});

export const POST = handler(withToolUsage("free-check", async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  // Cheap syntax check first so a typo doesn't use up one of the visitor's checks.
  const normalized = normalizeInputUrl(body.url);
  if (!normalized) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const ip = clientIp(req);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "The security check failed. Please try again.");
  }

  setToolUsage({ url: body.url.trim() });
  const finish = async (item: Omit<FreeCheckResult, "leadId" | "benchmark">) => {
    // Comparison with earlier checks first (so this check doesn't count itself), then the lead; each waits ≤1.5s.
    const benchmark = await Promise.race([
      freeCheckBenchmark(item.overall.score),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LEAD_WAIT_MS)),
    ]);
    const leadId = await Promise.race([
      recordLead({ source: "free_check", url: item.url, score: item.overall.score, message: topFixMessage(item.issues[0]?.title), ip, attribution: body.attribution }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LEAD_WAIT_MS)),
    ]);
    setToolUsage({ url: item.url, score: item.overall.score, leadId });
    // Meta: a score on screen is ViewContent. "Lead" is sent once per WhatsApp number saved (…/free-check/whatsapp).
    const v = metaVisitor(req);
    trackMeta({ name: "ViewContent", eventId: leadId ? `check-${leadId}` : undefined, sourceUrl: v.sourceUrl, user: v.user, custom: { content_name: "free_check" } });
    return json({ item: { ...item, leadId, benchmark } }, { headers: { "Cache-Control": "no-store" } });
  };

  // Same site checked in the last 24 hours: answer from the cache, without using one of the visitor's checks.
  const cached = getCachedFreeCheck(normalized);
  if (cached) return finish(cached);

  const limit = checkFreeCheckLimit(ip);
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used your free checks for this hour. Start your 7-day free trial to check any website as often as you like, or try again in an hour."
        : "Lots of people are running checks right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec, scope: limit.scope });
  }

  try {
    const valid = await validateFreeCheckUrl(body.url);
    if (!valid.ok) throw new HttpError(400, valid.code, valid.message);
    const item = await runFreeCheck(valid.url);
    setCachedFreeCheck([normalized, item.url], item);
    return await finish(item);
  } catch (e) {
    // A check that didn't produce a score doesn't count against the hourly limit.
    refundFreeCheck(ip);
    if (e instanceof FreeCheckError) throw new HttpError(e.code === "blocked_url" ? 400 : 422, e.code, e.message);
    throw e;
  }
}));
