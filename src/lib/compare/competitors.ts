// Competitor facts for the /compare pages. Every fact was read on the competitor's OWN public page on `checkedOn`
// and carries that page as its source. Prices stay in the competitor's own currency (never converted to INR).
// If a fact can't be verified on their site, it does not go in here. Re-check before changing `checkedOn`.

export type CompetitorId = "ahrefs" | "semrush" | "se-ranking" | "ubersuggest" | "search-console";

export interface CompetitorFact {
  text: string;
  /** The competitor's own public page the fact was read on. */
  source: string;
}

export interface Competitor {
  id: CompetitorId;
  name: string;
  site: string;
  /** ISO date the facts were checked. */
  checkedOn: string;
  /** The page prices were read on. */
  pricingUrl: string;
  pricingFrom: { amount: number; currency: "USD"; period: "month"; note: string };
  facts: CompetitorFact[];
}

export const CHECKED_ON = "2026-11-09";

const AHREFS_PRICING = "https://ahrefs.com/pricing";
const AHREFS_RADAR = "https://ahrefs.com/brand-radar";
const AHREFS_DATA = "https://ahrefs.com/big-data";
const SEMRUSH_PRICING = "https://www.semrush.com/prices/";
const SEMRUSH_AI = "https://www.semrush.com/kb/1493-ai-toolkit";
const SER_PRICING = "https://seranking.com/pricing.html";
const SER_HOME = "https://seranking.com/";
const UBER_PRICING = "https://ubersuggest.com/en/pricing";
const GSC_HELP = "https://support.google.com/webmasters/answer/9128668";
const GSC_ABOUT = "https://search.google.com/search-console/about";

export const COMPETITORS: Record<CompetitorId, Competitor> = {
  ahrefs: {
    id: "ahrefs",
    name: "Ahrefs",
    site: "https://ahrefs.com",
    checkedOn: CHECKED_ON,
    pricingUrl: AHREFS_PRICING,
    pricingFrom: { amount: 29, currency: "USD", period: "month", note: "Starter plan. Lite is $129/mo; a free plan also exists." },
    facts: [
      { text: "Paid plans: Starter $29/mo, Lite $129/mo, Standard $249/mo, Advanced $449/mo; Enterprise is priced by sales.", source: AHREFS_PRICING },
      { text: "There is a free plan (Ahrefs Free).", source: AHREFS_PRICING },
      { text: "Paying annually saves up to 17%.", source: AHREFS_PRICING },
      { text: "Lite includes 750 tracked keywords, 150 checks on AI prompts and 1 user; extra users cost $40/mo each.", source: AHREFS_PRICING },
      { text: "Standard includes 2,000 tracked keywords and 300 checks on AI prompts.", source: AHREFS_PRICING },
      { text: "Historical data: 6 months on Lite, 2 years on Standard, 5 years on Advanced. Lite includes 100,000 crawl credits.", source: AHREFS_PRICING },
      { text: "Brand Radar AI starts from $199/mo; custom AI prompt packages start at $50/mo.", source: AHREFS_PRICING },
      { text: "Brand Radar tracks ChatGPT, Perplexity, Gemini, Copilot, AI Overviews, AI Mode and Claude.", source: AHREFS_RADAR },
      { text: "Ahrefs says it crawls about 5 million pages every minute, 24/7.", source: AHREFS_DATA },
      { text: "Ahrefs describes its backlink index as the world's largest index of live backlinks, updated every 15–30 minutes.", source: AHREFS_DATA },
    ],
  },
  semrush: {
    id: "semrush",
    name: "Semrush",
    site: "https://www.semrush.com",
    checkedOn: CHECKED_ON,
    pricingUrl: SEMRUSH_PRICING,
    pricingFrom: { amount: 139, currency: "USD", period: "month", note: "SEO plan billed monthly ($117.33/mo billed annually). A limited free plan exists." },
    facts: [
      { text: "SEO plan: $139/mo, or $117.33/mo billed annually, with 5 websites and 500 keywords tracked daily.", source: SEMRUSH_PRICING },
      { text: "Starter (SEO plus AI search): $199/mo, or $165.17/mo billed annually, with 50 AI prompts tracked daily.", source: SEMRUSH_PRICING },
      { text: "Pro+: $299/mo, or $248.17/mo billed annually, with 15 websites, 1,500 keywords and 100 AI prompts daily.", source: SEMRUSH_PRICING },
      { text: "Advanced is custom-priced (40+ websites, 5,000+ keywords).", source: SEMRUSH_PRICING },
      { text: "Free plan: 1 demo project and 10 reports a day, no credit card.", source: SEMRUSH_PRICING },
      { text: "A 7-day free trial is offered on paid plans.", source: SEMRUSH_PRICING },
      { text: "Additional users start at $45/mo.", source: SEMRUSH_PRICING },
      { text: "Site Audit crawls your entire site and checks for hundreds of technical and on-page issues.", source: "https://www.semrush.com/siteaudit/" },
      { text: "Semrush says its backlink index holds more than 43 trillion backlinks and 390 million referring domains.", source: "https://www.semrush.com/analytics/backlinks/" },
      { text: "Semrush says its keyword database has more than 26 billion keywords.", source: "https://www.semrush.com/analytics/keywordmagic/" },
      { text: "Its help centre lists the AI Visibility Toolkit at $99 a month, with no free trial; it tracks prompts in ChatGPT and Google AI Mode.", source: SEMRUSH_AI },
    ],
  },
  "se-ranking": {
    id: "se-ranking",
    name: "SE Ranking",
    site: "https://seranking.com",
    checkedOn: CHECKED_ON,
    pricingUrl: SER_PRICING,
    pricingFrom: { amount: 129, currency: "USD", period: "month", note: "Core plan billed monthly ($103.20/mo billed annually)." },
    facts: [
      { text: "Core: $129/mo, or $103.20/mo billed annually, with 10 projects, 2,000 keywords tracked daily and 250,000 audited pages a month.", source: SER_PRICING },
      { text: "Growth: $279/mo, or $223.20/mo billed annually, with 30 projects, 5,000 keywords tracked daily and 2 million audited pages a month.", source: SER_PRICING },
      { text: "Core and Growth include 25 AI prompts tracked daily across 5 AI engines.", source: SER_PRICING },
      { text: "An AI search add-on for more prompts starts from $71/mo.", source: SER_PRICING },
      { text: "14-day free trial, no credit card required.", source: SER_PRICING },
      { text: "Tools include a rank tracker, keyword research, a backlink checker, a website audit and AI trackers for AI Overviews, AI Mode, ChatGPT and Gemini.", source: SER_HOME },
      { text: "SE Ranking lists 188 country databases and a 5.5 billion keyword database.", source: SER_HOME },
    ],
  },
  ubersuggest: {
    id: "ubersuggest",
    name: "Ubersuggest",
    site: "https://ubersuggest.com",
    checkedOn: CHECKED_ON,
    pricingUrl: UBER_PRICING,
    pricingFrom: { amount: 29, currency: "USD", period: "month", note: "Individual plan; $290 one-time lifetime option. Prices are localised by region." },
    facts: [
      { text: "Individual: $29/mo or $290 lifetime, 1 website, 125 tracked keywords per project, 150 searches a day.", source: UBER_PRICING },
      { text: "Business: $49/mo or $490 lifetime, 7 websites, 150 tracked keywords per project, 300 searches a day.", source: UBER_PRICING },
      { text: "Enterprise/Agency: $99/mo or $990 lifetime, 15 websites, 300 tracked keywords per project, 900 searches a day.", source: UBER_PRICING },
      { text: "Monthly plans have a 7-day free trial; yearly and lifetime plans do not.", source: UBER_PRICING },
      { text: "Ubersuggest shows localised pricing based on the visitor's region.", source: UBER_PRICING },
    ],
  },
  "search-console": {
    id: "search-console",
    name: "Google Search Console",
    site: "https://search.google.com/search-console",
    checkedOn: CHECKED_ON,
    pricingUrl: GSC_HELP,
    pricingFrom: { amount: 0, currency: "USD", period: "month", note: "Free service from Google." },
    facts: [
      { text: "Google Search Console is a free service offered by Google.", source: GSC_HELP },
      { text: "It helps you monitor, maintain and troubleshoot your site's presence in Google Search results.", source: GSC_HELP },
      { text: "It shows your Search traffic and performance and your index coverage.", source: GSC_ABOUT },
      { text: "It can email you when Google finds issues on your site.", source: GSC_ABOUT },
    ],
  },
};

/** "2026-11-09" → "9 Nov 2026" (fixed English month names, no locale surprises). */
export function formatCheckedOn(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** "$129/mo" — always the competitor's own currency. */
export function formatFrom(c: Competitor): string {
  if (c.pricingFrom.amount === 0) return "Free";
  const symbol = c.pricingFrom.currency === "USD" ? "$" : `${c.pricingFrom.currency} `;
  return `${symbol}${c.pricingFrom.amount.toLocaleString("en-US")}/mo`;
}

/** Comparison pages and the competitor each one is about. */
export const COMPARE_PAGES = [
  { path: "/compare/ahrefs", competitor: "ahrefs", label: "MyWebRank vs Ahrefs" },
  { path: "/compare/semrush", competitor: "semrush", label: "MyWebRank vs Semrush" },
  { path: "/compare/se-ranking", competitor: "se-ranking", label: "MyWebRank vs SE Ranking" },
  { path: "/compare/ahrefs-alternatives", competitor: "ahrefs", label: "Ahrefs alternatives in India" },
] as const satisfies readonly { path: string; competitor: CompetitorId; label: string }[];

/** Names joined as "A, B and C". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Nominative-use note shown on every comparison page. */
export function trademarkNote(names: readonly string[] = ["Ahrefs", "Semrush", "SE Ranking"]): string {
  return `${joinNames(names)} are trademarks of their respective owners. MyWebRank is not affiliated with them.`;
}
