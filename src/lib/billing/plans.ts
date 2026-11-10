// Plans & limits (blueprint §10). priceInrMonthly = INR list price per month BEFORE GST (GST is added on top when we
// are GST-registered: src/lib/billing/gst.ts). Prices are defined ONLY here.
import type { PlanId, PlanLimits } from "@/lib/types";

export const TRIAL_DAYS = 7;

/**
 * AI limits per plan — the ONE plan config read by the app, pricing page, billing settings and admin. Kept local
 * (PlanLimits in @/lib/types is a frozen shared contract), so PLANS is typed with the extended shape; it is still
 * assignable to Record<PlanId, PlanLimits>.
 *   aiAnswersPerMonth — AI answers (one question asked to one AI assistant) per calendar month (UTC). THE customer limit.
 *   maxPromptsPerRun  — customer questions asked per AI check.
 *   enginesPerCheck   — AI assistants asked per AI check.
 *   aiDailyBudgetUsd  — hard cap on this workspace's AI spend per UTC day (cost protection; never shown to customers).
 * aiAnswersPerMonth is a whole number of full checks (questions × engines), so "N AI checks a month" is exact.
 * monthlyCredits stay INTERNAL (cost tracking across website checks + AI); customers only ever see AI answers.
 * PLACEHOLDER budgets — tune once real provider costs per plan are known.
 */
export interface PlanAiLimits {
  aiAnswersPerMonth: number;
  maxPromptsPerRun: number;
  enginesPerCheck: number;
  aiDailyBudgetUsd: number;
}
export type PlanWithAiLimits = PlanLimits & PlanAiLimits;

export const PLAN_IDS = ["trial", "starter", "growth", "agency"] as const satisfies readonly PlanId[];

export const PLANS: Record<PlanId, PlanWithAiLimits> = {
  // Trial: one full AI check (10 questions × 3 AI assistants = 30 answers) during TRIAL_DAYS.
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
    aiAnswersPerMonth: 30,
    maxPromptsPerRun: 10,
    enginesPerCheck: 3,
    aiDailyBudgetUsd: 1, // PLACEHOLDER
  },
  // 300 answers = 4 checks of 25 questions × 3 assistants.
  starter: {
    id: "starter",
    name: "Starter",
    priceInrMonthly: 1_999,
    maxProjects: 1,
    maxTrackedPrompts: 50,
    maxPagesPerCrawl: 250,
    monthlyCredits: 2_500,
    minScanIntervalDays: 7,
    seats: 2,
    competitorTracking: true,
    approvalPublishing: true,
    aiAnswersPerMonth: 300,
    maxPromptsPerRun: 25,
    enginesPerCheck: 3,
    aiDailyBudgetUsd: 2, // PLACEHOLDER
  },
  // 1,200 answers = 6 checks of 40 questions × 5 assistants.
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
    aiAnswersPerMonth: 1_200,
    maxPromptsPerRun: 40,
    enginesPerCheck: 5,
    aiDailyBudgetUsd: 6, // PLACEHOLDER
  },
  // 6,000 answers = 12 checks of 100 questions × 5 assistants.
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
    aiAnswersPerMonth: 6_000,
    maxPromptsPerRun: 100,
    enginesPerCheck: 5,
    aiDailyBudgetUsd: 25, // PLACEHOLDER
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

/** Most AI assistants any check uses (done-for-you clients always get all of them). */
export const MAX_ENGINES = 5;

/**
 * AI engines asked per AI check. The registry orders providers by priority (OPENROUTER_VISIBILITY_MODELS first:
 * ChatGPT, Gemini, Perplexity, Claude, Grok), so smaller plans get the most-used engines first.
 */
export function getEngineLimit(planId: string, serviceTier?: string | null): number {
  if (serviceTier) return MAX_ENGINES;
  return getPlanWithAiLimits(planId).enginesPerCheck;
}

/** Questions asked per AI check (never above the plan's tracked-question limit). */
export function questionsPerCheck(planId: string): number {
  const p = getPlanWithAiLimits(planId);
  return Math.min(p.maxPromptsPerRun, p.maxTrackedPrompts);
}

/** AI answers one full check uses on this plan (questions × engines). */
export function answersPerCheck(planId: string): number {
  return questionsPerCheck(planId) * getEngineLimit(planId);
}

/** Full AI checks a month that fit in the plan's AI answers (for pricing/billing copy). */
export function checksPerMonth(planId: string): number {
  return Math.floor(getPlanWithAiLimits(planId).aiAnswersPerMonth / Math.max(1, answersPerCheck(planId)));
}
