// Monthly plan allowances for the paid-data features, counted from the DataForSEO usage ledger (per organization,
// calendar month in UTC). Proposed numbers — the owner confirms them before they go on the pricing page.
import type { PlanId } from "@/lib/types";
import { db } from "@/lib/db";
import type { DfsFeature } from "./client";

/** Units per calendar month. Rank tracker units = keyword checks; others = lookups. 0 = not on this plan. */
export const DFS_MONTHLY_ALLOWANCE: Record<DfsFeature, Record<PlanId, number>> = {
  // 50 keywords weekly (≈ 220 checks) on Starter; 300 daily on Growth; 1,500 daily on Agency.
  rank_tracker: { trial: 40, starter: 250, growth: 9_500, agency: 46_500 },
  keyword_research: { trial: 5, starter: 20, growth: 200, agency: 1_000 },
  serp_checker: { trial: 5, starter: 30, growth: 300, agency: 1_500 },
  backlinks: { trial: 2, starter: 10, growth: 100, agency: 500 },
  competitor_traffic: { trial: 3, starter: 20, growth: 200, agency: 1_000 },
  keyword_gap: { trial: 1, starter: 5, growth: 50, agency: 250 },
  link_gap: { trial: 1, starter: 5, growth: 50, agency: 250 },
  domain_compare: { trial: 1, starter: 10, growth: 100, agency: 500 },
};

export function monthlyAllowance(feature: DfsFeature, planId: string | null | undefined): number {
  const row = DFS_MONTHLY_ALLOWANCE[feature];
  return planId && planId in row ? row[planId as PlanId] : row.trial;
}

/** Start of the current calendar month (UTC). Exported for tests. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function usedThisMonth(organizationId: string, feature: DfsFeature, now = new Date()): Promise<number> {
  const agg = await db.dataForSeoUsage.aggregate({
    where: { organizationId, feature, createdAt: { gte: monthStart(now) } },
    _sum: { units: true },
  });
  return agg._sum.units ?? 0;
}

export interface AllowanceStatus {
  feature: DfsFeature;
  used: number;
  limit: number;
  remaining: number;
  /** When the allowance resets (first day of next month, UTC). */
  resetsAt: string;
}

export async function allowanceStatus(organizationId: string, planId: string | null | undefined, feature: DfsFeature, now = new Date()): Promise<AllowanceStatus> {
  const used = await usedThisMonth(organizationId, feature, now);
  const limit = monthlyAllowance(feature, planId);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { feature, used, limit, remaining: Math.max(0, limit - used), resetsAt: next.toISOString() };
}

/** Plain-English message when the monthly allowance is used up. */
export function allowanceMessage(s: AllowanceStatus): string {
  const date = new Date(s.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" });
  return s.limit === 0
    ? "This isn't included in your plan. Upgrade to use it."
    : `You've used all ${s.limit} for this month. It resets on ${date}, or upgrade for more.`;
}
