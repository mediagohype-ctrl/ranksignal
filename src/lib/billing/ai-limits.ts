// Per-plan AI-check limits + scan rate limits (cost protection on top of monthly credits).
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getPlanWithAiLimits } from "./plans";

export const CRAWL_MIN_INTERVAL_MS = 10 * 60 * 1000;

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Runs that never produced an answer (failed/cancelled with nothing collected) don't count toward the limit. */
const COUNTED_RUN = { NOT: { status: { in: ["failed", "cancelled"] }, collected: 0 } };

export interface VisibilityRunAllowance {
  used: number;
  limit: number;
  remaining: number;
  maxPromptsPerRun: number;
  period: string;
}

export async function getVisibilityRunAllowance(orgId: string, now = new Date()): Promise<VisibilityRunAllowance> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  const used = await db.visibilityRun.count({
    where: { organizationId: orgId, createdAt: { gte: utcMonthStart(now) }, ...COUNTED_RUN },
  });
  return {
    used,
    limit: plan.maxVisibilityRunsPerMonth,
    remaining: Math.max(0, plan.maxVisibilityRunsPerMonth - used),
    maxPromptsPerRun: Math.min(plan.maxPromptsPerRun, plan.maxTrackedPrompts),
    period: now.toISOString().slice(0, 7),
  };
}

/** HttpError 402 "plan_limit" when this month's AI-check allowance is used up. */
export async function assertVisibilityRunAllowed(orgId: string, now = new Date()): Promise<VisibilityRunAllowance> {
  const a = await getVisibilityRunAllowance(orgId, now);
  if (a.remaining <= 0) {
    throw new HttpError(
      402,
      "plan_limit",
      `You've used all ${a.limit} AI visibility checks included in your plan this month. Upgrade for more, or wait until next month.`,
      { limit: a.limit, used: a.used, upgradeUrl: "/app/settings?tab=billing" },
    );
  }
  return a;
}

/**
 * Max tracked prompts a single visibility run may ask (plan.maxPromptsPerRun, never above maxTrackedPrompts).
 * The visibility job should use this as the `take` for its prompt query.
 */
export async function getRunPromptCap(orgId: string): Promise<number> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  return Math.min(plan.maxPromptsPerRun, plan.maxTrackedPrompts);
}

/**
 * Seconds until a new crawl may start for this project (0 = allowed). One crawl per CRAWL_MIN_INTERVAL_MS;
 * crawls that failed without reading any page don't count (so a fixed URL can be retried at once).
 */
export async function crawlRetryAfterSec(orgId: string, projectId: string, now = new Date()): Promise<number> {
  const last = await db.crawlRun.findFirst({
    where: {
      organizationId: orgId,
      projectId,
      createdAt: { gt: new Date(now.getTime() - CRAWL_MIN_INTERVAL_MS) },
      NOT: { status: { in: ["failed", "cancelled"] }, pagesCrawled: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return 0;
  return Math.max(1, Math.ceil((last.createdAt.getTime() + CRAWL_MIN_INTERVAL_MS - now.getTime()) / 1000));
}
