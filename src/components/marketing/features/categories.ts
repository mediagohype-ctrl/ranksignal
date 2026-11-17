// Which features are switched on. The /features page shows what works today in four cards (FEATURE_CARDS) and
// everything that is waiting for an outside data supplier in one "Coming next" strip (COMING_NEXT).
import { COMING_NEXT, type FeatureAvailability } from "@/components/marketing/content";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import { isPlacesConfigured } from "@/lib/business-profile/places";

/**
 * Is the outside data a feature needs switched on? Env-only checks, safe on a static marketing page.
 * Features without an `availability` requirement are always live.
 */
export function isFeatureLive(availability: FeatureAvailability | undefined): boolean {
  switch (availability) {
    case undefined:
      return true;
    case "google-data":
      return dfsConfigured();
    case "backlink-data":
      return backlinksEnabled();
    case "maps-data":
      return isPlacesConfigured();
  }
}

/** The unfinished features, split by whether their data supplier is switched on right now. */
export function comingNext(): { waiting: typeof COMING_NEXT; live: typeof COMING_NEXT } {
  return {
    waiting: COMING_NEXT.filter((f) => !isFeatureLive(f.availability)),
    live: COMING_NEXT.filter((f) => isFeatureLive(f.availability)),
  };
}
