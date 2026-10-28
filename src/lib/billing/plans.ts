// Plans & limits (blueprint §10). Prices are INR list prices (placeholder until pricing is final).
import type { PlanId, PlanLimits } from "@/lib/types";

export const TRIAL_DAYS = 7;

/**
 * AI-check limits per plan. Kept local (PlanLimits in @/lib/types is a frozen shared contract), so PLANS is typed
 * with the extended shape; it is still assignable to Record<PlanId, PlanLimits>.
 *   maxVisibilityRunsPerMonth — AI visibility checks an organization may start per calendar month (UTC).
 *   maxPromptsPerRun          — tracked questions asked per check (caps provider calls per run).
 * PLACEHOLDER VALUES — tune once real provider costs per plan are known.
 */
export interface PlanAiLimits {
  maxVisibilityRunsPerMonth: number;
  maxPromptsPerRun: number;
}
export type PlanWithAiLimits = PlanLimits & PlanAiLimits;

export const PLANS: Record<PlanId, PlanWithAiLimits> = {
  // Trial mirrors Starter limits for TRIAL_DAYS, with a smaller credit pool.
  trial: {
    id: "trial",
    name: "Free trial",
    priceInrMonthly: null,
    maxProjects: 1,
    maxTrackedPrompts: 50,
    maxPagesPerCrawl: 250,
    monthlyCredits: 1_000,
    minScanIntervalDays: 7,
    seats: 2,
    competitorTracking: true,
    approvalPublishing: true,
    maxVisibilityRunsPerMonth: 2, // PLACEHOLDER
    maxPromptsPerRun: 10, // PLACEHOLDER
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceInrMonthly: 2_999,
    maxProjects: 1,
    maxTrackedPrompts: 50,
    maxPagesPerCrawl: 250,
    monthlyCredits: 2_500,
    minScanIntervalDays: 7,
    seats: 2,
    competitorTracking: true,
    approvalPublishing: true,
    maxVisibilityRunsPerMonth: 4, // PLACEHOLDER
    maxPromptsPerRun: 25, // PLACEHOLDER
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceInrMonthly: 7_999,
    maxProjects: 3,
    maxTrackedPrompts: 200,
    maxPagesPerCrawl: 1_000,
    monthlyCredits: 10_000,
    minScanIntervalDays: 1,
    seats: 5,
    competitorTracking: true,
    approvalPublishing: true,
    maxVisibilityRunsPerMonth: 12, // PLACEHOLDER
    maxPromptsPerRun: 60, // PLACEHOLDER
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceInrMonthly: 19_999,
    maxProjects: 15,
    maxTrackedPrompts: 1_000,
    maxPagesPerCrawl: 5_000,
    monthlyCredits: 50_000,
    minScanIntervalDays: 1,
    seats: 15,
    competitorTracking: true,
    approvalPublishing: true,
    maxVisibilityRunsPerMonth: 40, // PLACEHOLDER
    maxPromptsPerRun: 150, // PLACEHOLDER
  },
};

export const PAID_PLAN_IDS = ["starter", "growth", "agency"] as const satisfies readonly PlanId[];

export function isPlanId(id: string): id is PlanId {
  return Object.prototype.hasOwnProperty.call(PLANS, id);
}

/** Unknown plan ids fall back to trial limits (fail closed toward the smallest plan). */
export function getPlan(planId: string): PlanLimits {
  return isPlanId(planId) ? PLANS[planId] : PLANS.trial;
}

/** Plan limits including the AI-check limits (unknown ids fall back to trial). */
export function getPlanWithAiLimits(planId: string): PlanWithAiLimits {
  return isPlanId(planId) ? PLANS[planId] : PLANS.trial;
}

/** Razorpay plan ids are configured per environment: RAZORPAY_PLAN_STARTER / _GROWTH / _AGENCY. */
export function razorpayPlanIdFor(planId: PlanId): string | undefined {
  return process.env[`RAZORPAY_PLAN_${planId.toUpperCase()}`] || undefined;
}

export function planIdFromRazorpayPlan(razorpayPlanId: string | undefined | null): PlanId | null {
  if (!razorpayPlanId) return null;
  for (const id of PAID_PLAN_IDS) if (razorpayPlanIdFor(id) === razorpayPlanId) return id;
  return null;
}
