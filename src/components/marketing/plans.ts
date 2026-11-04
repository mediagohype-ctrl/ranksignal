// Marketing view of the billing plans. Limits and prices always come from @/lib/billing/plans
// so the website matches what the app enforces.
import {
  PAID_PLAN_IDS, TRIAL_DAYS, checksPerMonth, getEngineLimit, getPlan, getPlanWithAiLimits, questionsPerCheck,
} from "@/lib/billing/plans";
import type { PlanLimits } from "@/lib/types";

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export const num = (n: number) => n.toLocaleString("en-IN");
export const inr = (n: number) => `₹${num(n)}`;
export const freq = (days: number) => (days <= 1 ? "Daily" : days <= 7 ? "Weekly" : "Monthly");

const COPY: Record<PaidPlanId, { blurb: string; suffix?: string; featured?: boolean; cta: string }> = {
  starter: {
    blurb: "For one business that wants a clear picture of how it shows up on Google and in AI answers.",
    cta: `Start ${TRIAL_DAYS}-day free trial`,
  },
  growth: {
    blurb: "For growing businesses and teams looking after several websites.",
    featured: true,
    cta: `Start ${TRIAL_DAYS}-day free trial`,
  },
  agency: {
    blurb: "For agencies looking after many client websites.",
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
  /** AI limits the app enforces per plan (answers per month is the real limit; checks = whole checks that fit). */
  ai: { answersPerMonth: number; checksPerMonth: number; questionsPerCheck: number; engines: number };
}

const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** "300 AI answers a month (4 checks of 25 questions × 3 AI assistants)". */
export function aiAnswersLine(planId: string): string {
  const a = getPlanWithAiLimits(planId);
  const q = questionsPerCheck(planId);
  const e = getEngineLimit(planId);
  const c = checksPerMonth(planId);
  return `${num(a.aiAnswersPerMonth)} AI answers a month (${plural(c, "check")} of ${q} questions × ${plural(e, "AI assistant")})`;
}

/** The free trial's AI allowance, worded exactly as the app enforces it: "1 AI check: 10 questions × 3 AI assistants". */
export const TRIAL_AI = (() => {
  const q = questionsPerCheck("trial");
  const e = getEngineLimit("trial");
  const checks = checksPerMonth("trial");
  return {
    checks,
    questions: q,
    engines: e,
    answers: getPlanWithAiLimits("trial").aiAnswersPerMonth,
    summary: `${plural(checks, "AI check")}: ${q} questions × ${plural(e, "AI assistant")}`,
  };
})();

export const MARKETING_PLANS: MarketingPlan[] = PAID_PLAN_IDS.map((id) => {
  const l = getPlan(id);
  const a = getPlanWithAiLimits(id);
  const engines = getEngineLimit(id);
  const perCheck = questionsPerCheck(id);
  const plus = id === "agency" ? "+" : "";
  return {
    id,
    name: l.name,
    price: l.priceInrMonthly ?? 0,
    ...COPY[id],
    highlights: [
      `${num(l.maxProjects)}${plus} website${l.maxProjects === 1 ? "" : "s"}`,
      `${num(l.maxTrackedPrompts)}${plus} customer questions (up to ${num(perCheck)} per AI check)`,
      aiAnswersLine(id),
      `Weekly website check, up to ${num(l.maxPagesPerCrawl)} pages each time`,
      l.competitorTracking ? "Compare against your competitors" : "No competitor comparison",
      l.approvalPublishing ? "Fixes go live only with your OK, with undo" : "Fixes as step-by-step instructions",
      `${num(l.seats)}${plus} team member${l.seats === 1 ? "" : "s"}`,
      ...(id === "agency" ? ["White-label reports and emails"] : []),
    ],
    limits: l,
    ai: { answersPerMonth: a.aiAnswersPerMonth, checksPerMonth: checksPerMonth(id), questionsPerCheck: perCheck, engines },
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
    blurb: "For a local business that wants the basics done properly, every month, without learning any jargon.",
    includes: [
      "Up to 15 fixes made a month, after your OK",
      "Your Google Business Profile tidied up",
      "2 page refreshes a month",
      "50 customer questions on up to 5 AI assistants (ChatGPT, Claude, Gemini, Perplexity and more, depending on plan)",
      "Monthly report and a 30-minute call",
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
    blurb: "For businesses that want to be named for more customer questions, with new pages every month.",
    inherits: "Everything in Fix, plus",
    includes: [
      "4 new pages a month that answer customer questions",
      "10 business directory listings",
      "A review-request programme",
      "Questions-and-answers and comparison pages",
      "100 customer questions",
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
    blurb: "For businesses in crowded markets that want AI assistants to see them as a trusted source.",
    inherits: "Everything in Grow, plus",
    includes: [
      "8 articles a month",
      "2 articles about you on websites AI already links to",
      "Your business details made consistent across the web",
      "Honest, clearly labelled posts on Reddit and forums",
      "A detailed competitor review every 3 months",
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
