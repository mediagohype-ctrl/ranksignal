// Plan limits for the Business Profile monitor (lead wires these into the plan tables). Cost control: each snapshot is
// one Places API (New) Place Details call (Enterprise + Atmosphere fields because of rating/reviews); each search is
// one Text Search (Pro fields only).
import type { PlanId } from "@/lib/types";

/** Days between automatic snapshots. */
export const BUSINESS_PROFILE_REFRESH_DAYS: Record<PlanId, number> = {
  trial: 30, // one snapshot when picked; the trial rarely lasts long enough for another
  starter: 7,
  growth: 7,
  agency: 3,
};

/** "Refresh now": at most one manual snapshot per profile in this many hours. */
export const MANUAL_REFRESH_MIN_HOURS = 24;

/** Business searches per organization per hour (Text Search calls). */
export const SEARCHES_PER_HOUR = 20;

export function refreshDaysFor(planId: string | null | undefined): number {
  return planId && planId in BUSINESS_PROFILE_REFRESH_DAYS
    ? BUSINESS_PROFILE_REFRESH_DAYS[planId as PlanId]
    : BUSINESS_PROFILE_REFRESH_DAYS.trial;
}
