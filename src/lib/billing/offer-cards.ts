// The "Do it for me" and "Custom" cards on the Billing & usage tab (app audit 15 Nov 2026, Fix 6): Billing used to
// list only the free trial and Do it myself, so every "Upgrade" button led to a page with nothing to upgrade to.
// Information only — the buttons book a call / open WhatsApp; these offers have no online checkout.
//
// Names, prices and bullets come from the SAME definitions the pricing page uses (DFY_PLAN / CUSTOM_PLAN in
// src/components/marketing/plans.ts), so the app and the website can never disagree. Build on the SERVER:
// bookCallHref() reads BRAND_BOOKING_URL, which the browser bundle doesn't have.
import { bookCallHref } from "@/lib/brand";
import { CUSTOM_CONTACT_HREF, CUSTOM_PLAN, DFY_PLAN, inr, isExternalHref } from "@/components/marketing/plans";
import type { BillingOfferCard } from "@/components/app/billing-panel";
import { CUSTOM_PLAN_IDS, type OfferOrg } from "./offer";

export const BOOK_CALL_LABEL = "Book a free call";

export function billingOfferCards(org: OfferOrg | null | undefined, o: { gst?: boolean; bookHref?: string } = {}): BillingOfferCard[] {
  const bookHref = o.bookHref ?? bookCallHref();
  const managed = Boolean(org?.serviceTier && org.serviceTier.trim());
  return [
    {
      id: "dfy",
      name: DFY_PLAN.name,
      price: inr(DFY_PLAN.price),
      priceSuffix: o.gst ? "+ GST / month" : "/ month",
      blurb: [DFY_PLAN.blurb, DFY_PLAN.termNote ? `${DFY_PLAN.termNote}.` : ""].filter(Boolean).join(" "),
      includes: DFY_PLAN.includes,
      cta: BOOK_CALL_LABEL,
      href: bookHref,
      external: isExternalHref(bookHref),
      current: managed,
    },
    {
      id: "custom",
      name: CUSTOM_PLAN.name,
      price: CUSTOM_PLAN.priceLabel,
      blurb: `${CUSTOM_PLAN.blurb} ${CUSTOM_PLAN.start}`,
      includes: CUSTOM_PLAN.includes,
      cta: CUSTOM_PLAN.cta,
      href: CUSTOM_CONTACT_HREF,
      external: true,
      current: !managed && !!org && CUSTOM_PLAN_IDS.includes(org.planId),
    },
  ];
}
