// MyWebRank's side of every comparison, derived from the plan config the app enforces (never typed in by hand),
// so the /compare pages can't drift from /pricing.
import { MARKETING_PLANS, SERVICE_FROM_PRICE, TRIAL_DAYS, inr, num } from "@/components/marketing/plans";
import type { Cell } from "./compare-ui";

const [starter, growth, agency] = MARKETING_PLANS;

export const OUR = {
  starter,
  growth,
  agency,
  fromPrice: inr(starter.price),
  serviceFrom: inr(SERVICE_FROM_PRICE),
  trialDays: TRIAL_DAYS,
  connectors: "WordPress, Shopify, Webflow, Wix, GitHub, Contentful and Sanity",
  pages: `${num(starter.limits.maxPagesPerCrawl)} / ${num(growth.limits.maxPagesPerCrawl)} / ${num(agency.limits.maxPagesPerCrawl)}`,
} as const;

/** MyWebRank cells for the shared rows of the vs tables (same order as `sharedRowLabels`). */
export const OUR_CELLS: Record<string, Cell> = {
  audit: { s: "yes", note: `Weekly, up to ${OUR.pages} pages (Starter / Growth / Agency)` },
  backlinks: { s: "no", note: "Not offered today" },
  keywords: { s: "partial", note: "Your own Google Search Console queries only; no keyword database" },
  rank: { s: "no", note: "No daily rank tracker" },
  ai: {
    s: "yes",
    note: `In every plan: ${starter.ai.engines} AI assistants on Starter, all ${growth.ai.engines} (ChatGPT, Gemini, Perplexity, Claude, Grok) on Growth and Agency`,
  },
  todo: { s: "yes", note: "Plain-English to-do list, each fix linked to the problem it solves" },
  publish: { s: "yes", note: `Fixes go live only after your OK, with one-click undo (${OUR.connectors})` },
  service: { s: "yes", note: `From ${OUR.serviceFrom}/month plus setup` },
  currency: { text: "INR", note: "GST invoices; prices exclude GST" },
  free: { text: "Free check + trial", note: `${TRIAL_DAYS}-day free trial` },
  from: { text: `${OUR.fromPrice}/mo`, note: `${starter.name}: ${starter.limits.maxProjects} website, ${num(starter.ai.answersPerMonth)} AI answers a month` },
};
