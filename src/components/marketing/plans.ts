// Marketing view of the billing plans. Limits and prices always come from @/lib/billing/plans
// so the website matches what the app enforces.
import { PAID_PLAN_IDS, TRIAL_DAYS, getPlan } from "@/lib/billing/plans";
import type { PlanLimits } from "@/lib/types";

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export const num = (n: number) => n.toLocaleString("en-IN");
export const inr = (n: number) => `₹${num(n)}`;
export const freq = (days: number) => (days <= 1 ? "Daily" : days <= 7 ? "Weekly" : "Monthly");

const COPY: Record<PaidPlanId, { blurb: string; suffix?: string; featured?: boolean; cta: string }> = {
  starter: {
    blurb: "For one brand that wants a first clear picture of how it shows up in search and AI answers.",
    cta: `Start ${TRIAL_DAYS}-day free trial`,
  },
  growth: {
    blurb: "For marketing teams actively improving visibility across several sites or markets.",
    featured: true,
    cta: `Start ${TRIAL_DAYS}-day free trial`,
  },
  agency: {
    blurb: "For agencies and multi-brand teams looking after many client sites.",
    suffix: "+",
    cta: "Talk to us",
  },
};

export interface MarketingPlan {
  id: PaidPlanId;
  name: string;
  price: number;
  blurb: string;
  suffix?: string;
  featured?: boolean;
  cta: string;
  highlights: string[];
  limits: PlanLimits;
}

export const MARKETING_PLANS: MarketingPlan[] = PAID_PLAN_IDS.map((id) => {
  const l = getPlan(id);
  const plus = id === "agency" ? "+" : "";
  return {
    id,
    name: l.name,
    price: l.priceInrMonthly ?? 0,
    ...COPY[id],
    highlights: [
      `${num(l.maxProjects)}${plus} website${l.maxProjects === 1 ? "" : "s"}`,
      `${num(l.maxTrackedPrompts)}${plus} tracked AI questions`,
      `${freq(l.minScanIntervalDays)} checks, up to ${num(l.maxPagesPerCrawl)} pages each`,
      l.competitorTracking ? "Compare against your competitors" : "No competitor comparison",
      l.approvalPublishing ? "Approve-before-publish fixes with rollback" : "Fixes exported as instructions",
      `${num(l.seats)}${plus} team seats`,
    ],
    limits: l,
  };
});

export { TRIAL_DAYS };
