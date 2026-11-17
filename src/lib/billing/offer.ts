// Which offer a workspace is on, and what that offer includes (owner's decisions, 15 Nov 2026).
//
//   Do it myself  — plan "starter" (and the free trial). We show exactly what to change; the owner makes every
//                   change by hand. NO website connections, nothing changes the website automatically.
//   Do it for me  — Organization.serviceTier is set. Our team changes the website for the customer.
//   Custom        — legacy/staff-set plans "growth" and "agency". Same abilities as Do it for me.
//
// Sales line: "Do it myself: we show you exactly what to change. Do it for me: our team changes it for you."
// Pure functions only (no db), so server pages, client components and tests can all import this.

export interface OfferOrg {
  planId: string;
  serviceTier?: string | null;
}

export type OfferKind = "self" | "managed";

/** Plans staff set for Custom deals (never sold on the website). */
export const CUSTOM_PLAN_IDS: readonly string[] = ["growth", "agency"];

/** True for Do it for me (service tier set) and Custom plans: our team works on the website. */
export function isManagedOffer(org: OfferOrg | null | undefined): boolean {
  if (!org) return false;
  return Boolean(org.serviceTier && org.serviceTier.trim()) || CUSTOM_PLAN_IDS.includes(org.planId);
}

export function offerKind(org: OfferOrg | null | undefined): OfferKind {
  return isManagedOffer(org) ? "managed" : "self";
}

/**
 * Website connections (WordPress, Shopify, GitHub…), approvals/publishing, auto-fixes, "Pause all changes" and
 * IndexNow key-file setup exist only where our team makes the changes. Do it myself gets ready-to-paste fixes.
 */
export function canConnectWebsite(org: OfferOrg | null | undefined): boolean {
  return isManagedOffer(org);
}

/** Customer-facing name of the offer the workspace is on. */
export function offerName(org: OfferOrg | null | undefined): string {
  if (!org) return "Do it myself";
  if (org.serviceTier && org.serviceTier.trim()) return "Do it for me";
  if (CUSTOM_PLAN_IDS.includes(org.planId)) return "Custom";
  return org.planId === "trial" ? "Free trial" : "Do it myself";
}

/** What Do it myself gets instead of one-click publishing — one wording everywhere (pricing, billing, app). */
export const SELF_FIX_LINE = "Ready-to-paste fixes for any website, with step-by-step help";

/** The sales line, used wherever the two offers are explained side by side. */
export const OFFER_SALES_LINE = "Do it myself: we show you exactly what to change. Do it for me: our team changes it for you.";
