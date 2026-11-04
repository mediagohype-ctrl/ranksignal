// What a workspace may still use this month, in customer words: "AI answers left: 820 of 1,200".
// One AI answer = one customer question asked to one AI assistant. Credits stay internal (cost tracking).
//
//   used = real answers collected this month (simulated answers are free) + answers still expected by AI checks
//          in progress (queued, running, or waiting until tomorrow for the daily budget), so two checks can't
//          both be promised the same answers.
//   left = cap − used (never below 0). used + left = cap.
// Trial: the 30 answers cover the whole trial (not per calendar month), so resetsAt is null — upgrade for more.
import { db } from "@/lib/db";
import { getPlanWithAiLimits } from "./plans";
import { billingPeriod } from "./usage";

export interface AiAllowance {
  used: number;
  cap: number;
  left: number;
  /** Start of the next month (UTC) when the answers reset; null on the free trial (no reset). */
  resetsAt: Date | null;
}

/** Runs that still hold answers they are expected to collect. */
export const IN_FLIGHT_RUN_STATUSES = ["queued", "running"];

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextUtcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Answers an in-progress run still expects (expected − collected − failed, never below 0). */
export function outstandingAnswers(r: { sampleSize: number; collected: number; failed: number }): number {
  return Math.max(0, r.sampleSize - r.collected - r.failed);
}

/** Pure allowance math (exported for tests). */
export function computeAiAllowance(o: {
  cap: number;
  collected: number;
  inFlight: { sampleSize: number; collected: number; failed: number }[];
  trial: boolean;
  now?: Date;
}): AiAllowance {
  const cap = Math.max(0, Math.floor(o.cap));
  const pending = o.inFlight.reduce((a, r) => a + outstandingAnswers(r), 0);
  const used = Math.max(0, o.collected) + pending;
  // Shown as "used of cap": never more than the cap (e.g. a check that ran just past it).
  return { used: Math.min(used, cap), cap, left: Math.max(0, cap - used), resetsAt: o.trial ? null : nextUtcMonthStart(o.now) };
}

/**
 * AI answers used / left for an organization. `excludeRunId` leaves one run's outstanding answers out (the
 * visibility job uses it to size its own run).
 */
export async function getAiAllowance(orgId: string, o: { now?: Date; excludeRunId?: string } = {}): Promise<AiAllowance> {
  const now = o.now ?? new Date();
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true, createdAt: true } });
  const planId = org?.planId ?? "trial";
  const plan = getPlanWithAiLimits(planId);
  const trial = planId === "trial";
  // Trial answers count from signup; paid plans per calendar month (UTC), matching billingPeriod().
  const since = trial ? (org?.createdAt ?? utcMonthStart(now)) : utcMonthStart(now);
  const [collected, inFlight] = await Promise.all([
    db.observation.count({ where: { organizationId: orgId, simulated: false, createdAt: { gte: since } } }),
    db.visibilityRun.findMany({
      where: {
        organizationId: orgId,
        status: { in: IN_FLIGHT_RUN_STATUSES },
        createdAt: { gte: since },
        ...(o.excludeRunId ? { NOT: { id: o.excludeRunId } } : {}),
      },
      select: { sampleSize: true, collected: true, failed: true },
    }),
  ]);
  return computeAiAllowance({ cap: plan.aiAnswersPerMonth, collected, inFlight, trial, now });
}

export interface WebsiteCheckAllowance {
  /** False when this month's internal usage can't cover another full website check. */
  allowed: boolean;
  resetsAt: Date;
}

/**
 * Whether a website check can start this month. Website checks hold one internal credit per page (up to the
 * plan's pages per check), so block the button when the rest of the month can't cover a full check.
 */
export async function getWebsiteCheckAllowance(orgId: string, now = new Date()): Promise<WebsiteCheckAllowance> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  const rows = await db.usageLedger.groupBy({
    by: ["kind"],
    where: { organizationId: orgId, billingPeriod: billingPeriod(now) },
    _sum: { credits: true },
  });
  const sum = (k: string) => rows.find((r) => r.kind === k)?._sum.credits ?? 0;
  const used = sum("actual") + Math.max(0, sum("reservation") - sum("release"));
  return { allowed: plan.monthlyCredits - used >= plan.maxPagesPerCrawl, resetsAt: nextUtcMonthStart(now) };
}
