// Staff-facing wording helpers for the back-office (pure, unit-tested).
import type { OrgAccess } from "@/lib/billing/access";
import { getPlan } from "@/lib/billing/plans";

export interface OrgIdentity {
  name: string;
  website: string | null;
  ownerEmail: string | null;
}

/** Bare host of a website URL ("https://www.acme.in/" → "acme.in"); the input when it isn't a URL. */
export function hostLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * One-line label that tells apart organisations with the same name:
 * "Go Hype Media · gohypemedia.com · owner@gohypemedia.com".
 */
export function orgDisplayLabel(o: OrgIdentity): string {
  return [o.name, hostLabel(o.website), o.ownerEmail].filter(Boolean).join(" · ");
}

/** Access status written for staff (third person — never "Your plan"). */
export function staffAccessMessage(a: OrgAccess): string {
  const plan = getPlan(a.planId).name;
  switch (a.reason) {
    case "trial_expired":
      return "Free trial has ended. The customer must choose a plan to run checks again.";
    case "past_due":
      return a.active
        ? "Last payment failed — in the grace period. Checks still run."
        : "Checks are paused: last payment failed and the grace period is over.";
    case "cancelled":
      return a.active ? `${plan} plan is cancelled; it stays active until the period ends.` : `${plan} plan has ended.`;
    case "suspended":
      return "Organisation is suspended.";
    default:
      return `Customer's ${plan} plan is active.`;
  }
}
