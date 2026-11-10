// Plan limits and cost constants for the backlink checker + link gap (DataForSEO Backlinks API). The lead wires these
// into the plan tables / pricing page. Pure module (no DB) so client components can import it.
//
// HOW A REFRESH IS COUNTED (allowance units):
// A backlink refresh makes BACKLINK_CALLS_PER_REFRESH separate DataForSEO calls (summary, linking sites, links, anchor
// text, new & lost). One refresh = 1 unit of the "backlinks" allowance: the first call carries units: 1 and the
// other calls units: 0 (their cost is still recorded in the usage ledger). We check that a unit is left BEFORE starting.
// Link gap is one call = 1 unit of the "link_gap" allowance.
import type { PlanId } from "@/lib/types";

/** Separate DataForSEO calls per refresh (all recorded in the ledger; only the first counts against the allowance). */
export const BACKLINK_CALLS_PER_REFRESH = 5;
export const BACKLINK_UNITS_PER_REFRESH = 1;

/** High cost estimates (micro-USD) reserved against the owner's daily budget before each call. */
export const BACKLINKS_CALL_ESTIMATE_MICROS = 25_000; // base request + up to 100 rows
export const LINK_GAP_ESTIMATE_MICROS = 30_000; // domain_intersection, up to 100 rows

/** Days between automatic refreshes; null = no automatic refresh on this plan. */
export const BACKLINK_REFRESH_DAYS: Record<PlanId, number | null> = {
  trial: null,
  starter: 30, // monthly
  growth: 7, // weekly
  agency: 7, // weekly
};

/** "Refresh" button: at most once per project in this many hours (backlink indexes change slowly). */
export const MANUAL_REFRESH_MIN_HOURS = 24;

/** Paid actions per organization per hour (in-memory limiter, on top of the monthly allowance). */
export const BACKLINK_REFRESHES_PER_HOUR = 10;
export const LINK_GAP_LOOKUPS_PER_HOUR = 10;

/** Link gap: 1–3 competitor domains per lookup. */
export const LINK_GAP_MAX_COMPETITORS = 3;

/** Rows fetched per list (and stored per snapshot). */
export const LIST_LIMIT = 100;

/** Snapshots / link-gap reports kept per project (older ones are pruned after each refresh). */
export const SNAPSHOTS_KEPT = 26;
export const LINK_GAP_REPORTS_KEPT = 10;

export function refreshDaysFor(planId: string | null | undefined): number | null {
  return planId && planId in BACKLINK_REFRESH_DAYS ? BACKLINK_REFRESH_DAYS[planId as PlanId] : BACKLINK_REFRESH_DAYS.trial;
}

export function refreshesLeft(remainingUnits: number): number {
  return Math.max(0, Math.floor(remainingUnits / BACKLINK_UNITS_PER_REFRESH));
}

export function frequencyLabel(days: number | null): string {
  if (days === null) return "No automatic refresh on your plan";
  if (days <= 7) return "Refreshed automatically every week";
  return "Refreshed automatically every month";
}
