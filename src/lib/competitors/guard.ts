// Shared checks before any paid Competitors action: DataForSEO switched on, per-organization rate limit, and enough
// monthly allowance for the units this action will use. Also turns DataForSEO / budget failures into calm messages.
import { HttpError, json } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { AiBudgetError } from "@/lib/billing/ai-budget";
import { db } from "@/lib/db";
import { DFS_NOT_CONFIGURED, DfsError, dfsConfigured, type DfsFeature } from "@/lib/dataforseo/client";
import { allowanceMessage, allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import type { SessionContext } from "@/lib/types";

/** Paid Competitors actions per organization: 20 per 10 minutes (on top of the monthly allowance). */
export const PAID_RATE = { limit: 20, windowMs: 10 * 60 * 1000 } as const;

export async function orgPlanId(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return org?.planId ?? "trial";
}

/**
 * Run the checks. Returns a ready 402 Response when the allowance is short (shape `{ error: "allowance", message,
 * allowance }`), otherwise the plan id. Throws HttpError for "not configured" (501) and rate limits (429).
 */
export async function paidGuard(
  s: SessionContext,
  feature: DfsFeature,
  units: number,
  now = Date.now(),
): Promise<{ planId: string; status: AllowanceStatus } | Response> {
  if (!dfsConfigured()) throw new HttpError(501, "dfs_not_configured", DFS_NOT_CONFIGURED);
  if (!checkRateLimit(`competitors:paid:${s.organizationId}`, PAID_RATE.limit, PAID_RATE.windowMs, now).allowed) {
    throw new HttpError(429, "rate_limited", "That's a lot of lookups in a few minutes. Please wait a little and try again.");
  }
  const planId = await orgPlanId(s.organizationId);
  const status = await allowanceStatus(s.organizationId, planId, feature);
  if (status.remaining < units) {
    const message =
      status.limit === 0 || status.remaining === 0
        ? allowanceMessage(status)
        : `This needs ${units} of your monthly allowance but only ${status.remaining} ${status.remaining === 1 ? "is" : "are"} left. Try fewer domains, or upgrade for more.`;
    return json({ error: "allowance", message, allowance: status }, { status: 402 });
  }
  return { planId, status };
}

/** Map a failed paid call to a plain-English HttpError (never leaks provider internals). */
export function paidCallError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof AiBudgetError) {
    throw new HttpError(503, "budget_reached", "We've reached today's limit for live Google data. Please try again tomorrow.");
  }
  if (err instanceof DfsError) {
    if (err.errorClass === "transient") {
      throw new HttpError(503, "provider_unavailable", "Our data partner didn't answer in time. Please try again in a few minutes.");
    }
    throw new HttpError(502, "provider_error", "Our data partner couldn't answer this request. Check the domain and try again.");
  }
  throw err;
}
