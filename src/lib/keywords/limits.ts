// Plan limits for the Keywords feature (lead wires these into the plan tables). Counted per organization.
import type { PlanId } from "@/lib/types";

/** Keywords a workspace can star to watch on the "Tracked" tab (all projects together). */
export const KEYWORD_STAR_LIMITS: Record<PlanId, number> = {
  trial: 25,
  starter: 25,
  growth: 200,
  agency: 1_000,
};

export function keywordStarLimit(planId: string | null | undefined): number {
  return planId && planId in KEYWORD_STAR_LIMITS ? KEYWORD_STAR_LIMITS[planId as PlanId] : KEYWORD_STAR_LIMITS.trial;
}

export const RANGE_DAYS = [7, 28, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export function parseRangeDays(v: unknown): RangeDays {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return (RANGE_DAYS as readonly number[]).includes(n) ? (n as RangeDays) : 28;
}

/** Longest query we accept from the client (matches the sync's stored key cap). */
export const MAX_QUERY_LENGTH = 1000;
