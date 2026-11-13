// MyWebRank's side of every comparison, derived from the plan config the app enforces (never typed in by hand),
// so the /compare pages can't drift from /pricing. Public offer: "Do it myself", "Do it for me" and Custom.
import { CUSTOM_PLAN, DFY_PLAN, SELF_PLAN, TRIAL_DAYS, inrGst, num } from "@/components/marketing/plans";
import type { Cell } from "./compare-ui";

const ENGINE_NAMES = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"];
const engineList = (n: number) => {
  const names = ENGINE_NAMES.slice(0, n);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

export const OUR = {
  /** "Do it myself": the self-serve software plan. */
  self: SELF_PLAN,
  /** "Do it for me": our team does the work. */
  dfy: DFY_PLAN,
  custom: CUSTOM_PLAN,
  /** "₹1,999 + GST" (plain price when we are not GST-registered). */
  fromPrice: inrGst(SELF_PLAN.price),
  /** "₹19,999 + GST" (plain price when we are not GST-registered). */
  serviceFrom: inrGst(DFY_PLAN.price),
  trialDays: TRIAL_DAYS,
  /** "ChatGPT, Gemini and Perplexity". */
  engines: engineList(SELF_PLAN.ai.engines),
  connectors: "WordPress, Shopify, Webflow, Wix, GitHub, Contentful and Sanity",
  /** What "publishing a fix" really means per platform. Never claim live publishing beyond WordPress. */
  publishing: "One-click fixes with undo on WordPress; drafts or copy-paste steps for Shopify, Wix and Webflow",
  pages: num(SELF_PLAN.limits.maxPagesPerCrawl),
} as const;

/** MyWebRank cells for the shared rows of the vs tables (same order as `sharedRowLabels`). */
export const OUR_CELLS: Record<string, Cell> = {
  audit: { s: "yes", note: `Weekly, up to ${OUR.pages} pages` },
  backlinks: { s: "no", note: "Not offered today" },
  keywords: { s: "partial", note: "Your own Google Search Console queries only; no keyword database" },
  rank: { s: "no", note: "No daily rank tracker" },
  ai: {
    s: "yes",
    note: `${OUR.engines} on ${SELF_PLAN.name}, ${num(SELF_PLAN.ai.answersPerMonth)} AI answers a month`,
  },
  todo: { s: "yes", note: "Plain-English to-do list, each fix linked to the problem it solves" },
  publish: { s: "yes", note: `${OUR.publishing}. Nothing changes without your OK` },
  service: { s: "yes", note: `${DFY_PLAN.name} from ${OUR.serviceFrom}/month, no setup fee` },
  currency: { text: "INR", note: "GST invoices; prices exclude GST" },
  free: { text: "Free check + trial", note: `${TRIAL_DAYS}-day free trial` },
  from: {
    text: `${OUR.fromPrice}/mo`,
    note: `${SELF_PLAN.name}: ${SELF_PLAN.limits.maxProjects} website, ${num(SELF_PLAN.ai.answersPerMonth)} AI answers a month`,
  },
};
