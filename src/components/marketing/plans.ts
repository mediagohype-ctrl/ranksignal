// Marketing view of the billing plans. Limits and prices always come from @/lib/billing/plans
// so the website matches what the app enforces.
import {
  PAID_PLAN_IDS, PUBLIC_PLAN_IDS, TRIAL_DAYS, checksPerMonth, getEngineLimit, getPlan, getPlanWithAiLimits, questionsPerCheck,
} from "@/lib/billing/plans";
import { gstConfig, gstSuffix } from "@/lib/billing/gst";
import type { PlanLimits } from "@/lib/types";
import { BRAND } from "@/lib/brand";

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export const num = (n: number) => n.toLocaleString("en-IN");
export const inr = (n: number) => `₹${num(n)}`;
/** True when we are GST-registered (GSTIN set): every price then says "+ GST" (src/lib/billing/gst.ts). */
export const gstOn = () => gstSuffix() !== "";
/** "₹1,999 + GST" when GST applies, plain "₹1,999" when we are not GST-registered. Hindi copy uses it as-is. */
export const inrGst = (n: number) => `${inr(n)}${gstSuffix()}`;
/** Sentence for "prices are in rupees" notes. */
export const priceNote = (hi = false) =>
  hi
    ? gstOn()
      ? `सभी कीमतें भारतीय रुपये में हैं, ${gstConfig().ratePercent}% GST अलग।`
      : "सभी कीमतें भारतीय रुपये में हैं।"
    : gstOn()
      ? `Prices in Indian rupees, plus ${gstConfig().ratePercent}% GST.`
      : "Prices in Indian rupees.";
export const freq = (days: number) => (days <= 1 ? "Daily" : days <= 7 ? "Weekly" : "Monthly");

// Website Blueprint (Nov 2026): the public offer is two plans + Custom. "Do it myself" is the billing plan "starter".
const COPY: Partial<Record<PaidPlanId, { blurb: string; suffix?: string; featured?: boolean; cta: string }>> = {
  starter: {
    blurb: "We show you exactly what to fix.",
    cta: "Start free trial",
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

/** Engine names in the order checks use them (first N = the plan's engine limit). */
const ENGINE_NAMES = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"];
const listNames = (n: string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`);

/** Self-serve plans shown on the website: only "Do it myself" (see PUBLIC_PLAN_IDS). */
export const MARKETING_PLANS: MarketingPlan[] = PUBLIC_PLAN_IDS.map((id) => {
  const l = getPlan(id);
  const a = getPlanWithAiLimits(id);
  const engines = getEngineLimit(id);
  const perCheck = questionsPerCheck(id);
  return {
    id,
    name: l.name,
    price: l.priceInrMonthly ?? 0,
    blurb: COPY[id]?.blurb ?? "",
    cta: COPY[id]?.cta ?? "Start free trial",
    highlights: [
      "Your Found Score, plus your SEO, AEO, GEO and Brand scores",
      `A ${freq(l.minScanIntervalDays).toLowerCase()} check of your website, up to ${num(l.maxPagesPerCrawl)} pages`,
      `What ${listNames(ENGINE_NAMES.slice(0, engines))} say about you (${num(a.aiAnswersPerMonth)} AI answers a month)`,
      "A to-do list in plain words, most important first",
      "One-click fixes with undo on WordPress; easy copy-paste steps for other sites",
      "A monthly report you can read in 2 minutes",
    ],
    limits: l,
    ai: { answersPerMonth: a.aiAnswersPerMonth, checksPerMonth: checksPerMonth(id), questionsPerCheck: perCheck, engines },
  };
});

/** "Do it myself" — the one self-serve plan. */
export const SELF_PLAN = MARKETING_PLANS[0]!;

export { TRIAL_DAYS };

/* ------------------------------------------------------------------ done-for-you service tiers */
// Done-for-you service (Organization.serviceTier). Prices in INR, excluding GST. We promise delivery, never rankings.

// Website Blueprint (Nov 2026): one done-for-you offer, "Do it for me", ₹19,999/month, no setup fee, 3 months then
// month to month. Bigger needs go to Custom. (Org.serviceTier "fix" = Do it for me; "grow"/"authority" are legacy
// tiers kept for existing clients in src/lib/admin/money.ts and are never shown on the website.)

export type ServiceTierId = "fix";

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
    name: "Do it for me",
    price: 19_999,
    setup: 0,
    minimumMonths: 3,
    termNote: "3 months, then month to month",
    blurb: "Our team does all the work. You run your business.",
    inherits: "Everything in Do it myself, plus our team does the work",
    includes: [
      "Your website, fixed: everything that stops Google and AI finding you, most important first",
      "Your Google Business Profile, looked after: hours, photos, posts and replies to reviews",
      "New pages and articles that answer what your customers ask",
      "Your name in AI answers: we track what ChatGPT says about you and correct wrong facts",
      "Your listings, cleaned up: same name, address and phone on every top directory",
      "Your own expert on WhatsApp, plus a simple monthly report and call",
    ],
    questions: 50,
    updates: "Monthly report + call",
    featured: true,
  },
];

/** "Do it for me" — the one done-for-you offer. */
export const DFY_PLAN = SERVICE_TIERS[0]!;

/** Custom: for bigger needs. No public price. */
export const CUSTOM_PLAN = {
  name: "Custom",
  priceLabel: "Let's talk",
  blurb: "For big companies and agencies.",
  start: "Plan built around you.",
  cta: "Talk to us",
  includes: [
    "Many websites, brands, cities or countries",
    "A dedicated team and one point of contact",
    "Reports with your logo, for agencies",
    "API and dashboard access",
  ],
} as const;

export const SERVICE_FROM_PRICE = Math.min(...SERVICE_TIERS.map((t) => t.price));

/** Contact link that pre-fills the "Done-for-you services" topic (optionally a tier). */
export function servicesContactHref(tier?: ServiceTierId) {
  return `/contact?topic=services${tier ? `&tier=${tier}` : ""}`;
}

/** WhatsApp chat link with a pre-written message (opens the app on phones, WhatsApp Web on computers). */
export function whatsappHref(message: string): string {
  return `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** Custom plan: straight to WhatsApp with a ready message (owner, Nov 2026). */
export const CUSTOM_CONTACT_HREF = whatsappHref(
  [
    "Hi MyWebRank, I'm interested in a Custom plan.",
    "",
    "My website: ",
    "Number of websites / brands: ",
    "What I need: ",
  ].join("\n"),
);

/** Same for the Hindi pages. */
export const CUSTOM_CONTACT_HREF_HI = whatsappHref(
  [
    "नमस्ते MyWebRank, मुझे Custom प्लान के बारे में बात करनी है।",
    "",
    "मेरी वेबसाइट: ",
    "कितनी वेबसाइट / ब्रांड: ",
    "मुझे क्या चाहिए: ",
  ].join("\n"),
);

/** True for links that leave the site (open them in a new tab). */
export const isExternalHref = (href: string) => /^https?:\/\//.test(href);

/** Link props: links that leave the site (WhatsApp) open in a new tab. Spread onto <Link> / <a>. */
export const newTabProps = (href: string) =>
  isExternalHref(href) ? ({ target: "_blank", rel: "noopener noreferrer" } as const) : {};

/** Where a plan's button on the public site goes. Agency skips the trial and opens Razorpay checkout after sign-up. */
export function planSignupHref(planId: string): string {
  if (planId !== "agency") return `/signup?plan=${planId}`;
  return `/signup?plan=agency&next=${encodeURIComponent("/app/settings?tab=billing&plan=agency")}`;
}
