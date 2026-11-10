// Public API / MCP limits per plan. Kept here (not in src/lib/billing/plans.ts) so the lead can wire them into the
// plan tables later. PLACEHOLDER numbers — tune once real usage is known.
import type { PlanId } from "@/lib/types";

export interface ApiPlanLimits {
  /** Active (not revoked) keys an organization may hold. */
  maxKeys: number;
  /** Requests per key per minute (REST + MCP share one bucket). */
  perMinute: number;
  /** Requests per organization per UTC day, across all its keys. */
  perDay: number;
}

export const API_PLAN_LIMITS: Record<PlanId, ApiPlanLimits> = {
  trial: { maxKeys: 1, perMinute: 60, perDay: 500 },
  starter: { maxKeys: 2, perMinute: 60, perDay: 2_000 },
  growth: { maxKeys: 5, perMinute: 60, perDay: 10_000 },
  agency: { maxKeys: 20, perMinute: 60, perDay: 50_000 },
};

/** Unknown plan ids fall back to trial limits (fail closed toward the smallest plan). */
export function apiLimitsFor(planId: string): ApiPlanLimits {
  return Object.prototype.hasOwnProperty.call(API_PLAN_LIMITS, planId) ? API_PLAN_LIMITS[planId as PlanId] : API_PLAN_LIMITS.trial;
}
