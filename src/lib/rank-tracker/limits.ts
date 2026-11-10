// Plan limits and cost constants for the rank tracker (lead wires these into the plan tables / pricing page).
// Cost: one DataForSEO SERP "live advanced" call per keyword check (Google organic, depth 100).
import type { PlanId } from "@/lib/types";

export type RankFrequency = "daily" | "weekly";
export type RankDevice = "mobile" | "desktop";
export const RANK_DEVICES: readonly RankDevice[] = ["mobile", "desktop"];

/** How often each tracked keyword is checked automatically. */
export const RANK_TRACKER_FREQUENCY: Record<PlanId, RankFrequency> = {
  trial: "weekly",
  starter: "weekly",
  growth: "daily",
  agency: "daily",
};

/** Most active tracked keywords per project (each keyword + location + device counts once). */
export const RANK_TRACKER_MAX_KEYWORDS: Record<PlanId, number> = {
  trial: 10,
  starter: 50,
  growth: 300,
  agency: 1500,
};

/** High estimate of one SERP live advanced call at depth 100, in micro-USD (reserved against the daily budget). */
export const SERP_ADVANCED_ESTIMATE_MICROS = 4_000;
/** DataForSEO endpoint used for each check. */
export const SERP_ENDPOINT = "/v3/serp/google/organic/live/advanced";
export const SERP_DEPTH = 100;

/** Keywords checked at the same time, and the pause between those small batches. */
export const CHECK_BATCH_SIZE = 5;
export const CHECK_BATCH_PAUSE_MS = 1_500;
/** Most keywords one job run checks; the rest go to a follow-up run. */
export const MAX_CHECKS_PER_RUN = 100;
/** "Check now": once per project per this many hours. */
export const MANUAL_CHECK_MIN_HOURS = 24;
/** Keywords one POST may add. */
export const MAX_KEYWORDS_PER_REQUEST = 200;
/** "Check now" requests per organization per hour (in-memory limiter, all projects). */
export const MANUAL_CHECKS_PER_ORG_PER_HOUR = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

function asPlan(planId: string | null | undefined): PlanId {
  return planId && planId in RANK_TRACKER_MAX_KEYWORDS ? (planId as PlanId) : "trial";
}

export function rankFrequencyFor(planId: string | null | undefined): RankFrequency {
  return RANK_TRACKER_FREQUENCY[asPlan(planId)];
}

export function maxTrackedKeywordsFor(planId: string | null | undefined): number {
  return RANK_TRACKER_MAX_KEYWORDS[asPlan(planId)];
}

export function frequencyMs(f: RankFrequency): number {
  return f === "daily" ? DAY_MS : 7 * DAY_MS;
}
