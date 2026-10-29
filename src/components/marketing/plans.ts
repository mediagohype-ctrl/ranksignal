// Marketing view of the billing plans. Limits and prices always come from @/lib/billing/plans
// so the website matches what the app enforces.
import { PAID_PLAN_IDS, TRIAL_DAYS, getEngineLimit, getPlan, getPlanWithAiLimits } from "@/lib/billing/plans";
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
    blurb: "For marketing teams actively improving visibility across several websites.",
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
  /** AI-check limits the app enforces per plan. */
  ai: { checksPerMonth: number; questionsPerCheck: number; engines: number };
}

export const MARKETING_PLANS: MarketingPlan[] = PAID_PLAN_IDS.map((id) => {
  const l = getPlan(id);
  const a = getPlanWithAiLimits(id);
  const engines = getEngineLimit(id);
  const plus = id === "agency" ? "+" : "";
  return {
    id,
    name: l.name,
    price: l.priceInrMonthly ?? 0,
    ...COPY[id],
    highlights: [
      `${num(l.maxProjects)}${plus} website${l.maxProjects === 1 ? "" : "s"}`,
      `${num(l.maxTrackedPrompts)}${plus} tracked AI questions (up to ${num(a.maxPromptsPerRun)} per check)`,
      `${num(a.maxVisibilityRunsPerMonth)} AI checks a month on up to ${engines} AI engines`,
      `Weekly website scans, up to ${num(l.maxPagesPerCrawl)} pages each`,
      l.competitorTracking ? "Compare against your competitors" : "No competitor comparison",
      l.approvalPublishing ? "Approve-before-publish fixes with rollback" : "Fixes exported as instructions",
      `${num(l.seats)}${plus} team seats`,
      ...(id === "agency" ? ["White-label reports and emails"] : []),
    ],
    limits: l,
    ai: { checksPerMonth: a.maxVisibilityRunsPerMonth, questionsPerCheck: a.maxPromptsPerRun, engines },
  };
});

export { TRIAL_DAYS };

/* ------------------------------------------------------------------ done-for-you service tiers */
// Done-for-you service (Organization.serviceTier). Prices in INR, excluding GST. We promise delivery, never rankings.

export type ServiceTierId = "fix" | "grow" | "authority";

export interface ServiceTier {
  id: ServiceTierId;
  name: string;
  /** Monthly retainer, INR, excl. GST. */
  price: number;
  /** One-time setup fee, INR, excl. GST. */
  setup: number;
  minimumMonths: number;
  /** Extra term detail shown under the minimum. */
  termNote?: string;
  blurb: string;
  /** "Everything in X, plus" line. */
  inherits?: string;
  includes: string[];
  questions: number;
  updates: string;
  featured?: boolean;
}

export const SERVICE_TIERS: ServiceTier[] = [
  {
    id: "fix",
    name: "Fix",
    price: 19_999,
    setup: 9_999,
    minimumMonths: 3,
    blurb: "For a local business that wants the basics done properly, every month, without learning SEO.",
    includes: [
      "Up to 15 approved fixes shipped a month",
      "Google Business Profile optimisation",
      "2 page refreshes a month",
      "50 tracked questions on up to 5 AI engines (ChatGPT, Claude, Gemini, Perplexity and more, depending on plan)",
      "Monthly impact report and a 30-minute call",
    ],
    questions: 50,
    updates: "Monthly report + 30-minute call",
  },
  {
    id: "grow",
    name: "Grow",
    price: 49_999,
    setup: 19_999,
    minimumMonths: 6,
    blurb: "For businesses ready to win more of the questions buyers ask, with new pages every month.",
    inherits: "Everything in Fix, plus",
    includes: [
      "4 answer-shaped pages a month",
      "10 directory and citation listings",
      "A review-request programme",
      "FAQ and comparison pages",
      "100 tracked questions",
      "Fortnightly WhatsApp update",
    ],
    questions: 100,
    updates: "Fortnightly WhatsApp + monthly report",
    featured: true,
  },
  {
    id: "authority",
    name: "Authority",
    price: 119_999,
    setup: 39_999,
    minimumMonths: 6,
    termNote: "Or a 3-month pilot at +15%",
    blurb: "For brands in competitive categories that need to become a source AI assistants already trust.",
    inherits: "Everything in Grow, plus",
    includes: [
      "8 articles a month",
      "2 digital PR placements on sources AI already cites",
      "Entity clean-up across the web",
      "Disclosed Reddit and forum participation",
      "A quarterly competitor deep-dive",
      "Bi-weekly review call",
    ],
    questions: 100,
    updates: "Bi-weekly review + monthly report",
  },
];

export const SERVICE_FROM_PRICE = Math.min(...SERVICE_TIERS.map((t) => t.price));

/** Contact link that pre-fills the "Done-for-you services" topic (optionally a tier). */
export function servicesContactHref(tier?: ServiceTierId) {
  return `/contact?topic=services${tier ? `&tier=${tier}` : ""}`;
}
