// What the app menu can show for an account right now (server-only: reads env). The menu itself is the pure
// buildMenu() in src/components/app/nav.ts; this file only gathers its inputs.
import { canConnectWebsite, type OfferOrg } from "@/lib/billing/offer";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import type { MenuInput } from "@/components/app/nav";

/** Google Business Profile monitoring is switched on (same check as src/lib/business-profile/places.ts). */
export function businessProfileEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

export function menuInputFor(o: { org: OfferOrg | null; expert: boolean; websiteCount: number; staff?: boolean }): MenuInput {
  return {
    canConnect: canConnectWebsite(o.org),
    googleData: dfsConfigured(),
    backlinks: backlinksEnabled(),
    businessProfile: businessProfileEnabled(),
    expert: o.expert,
    websiteCount: o.websiteCount,
    staff: o.staff === true,
  };
}

/**
 * Whether this session may use website connections, publishing switches and IndexNow setup: Do it for me and
 * Custom accounts, and MyWebRank staff in support mode (who see everything).
 */
export function sessionCanConnect(org: OfferOrg | null | undefined, session: { staffMode?: boolean }): boolean {
  return session.staffMode === true || canConnectWebsite(org);
}
