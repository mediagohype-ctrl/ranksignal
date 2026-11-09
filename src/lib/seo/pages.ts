// Search snippets (title + description) and freshness dates for every static page on our own site.
// One registry so titles and descriptions stay unique and inside Google's limits (tests/seo/page-meta.test.ts).
//
// - `title` is the page part; the root layout appends " · MyWebRank" (TITLE_SUFFIX) unless `absolute` is set.
//   The FULL rendered title must be 30–60 characters, keyword first, brand last.
// - `description` must be 120–155 characters and unique.
// - `updated` (YYYY-MM-DD) is the last real content change: it feeds the sitemap lastmod, WebPage.dateModified
//   and the visible freshness signals. Bump it when you change a page's copy — never set it to "today" on every request.
import { MARKETING_PLANS, SERVICE_FROM_PRICE, TRIAL_DAYS, inr } from "@/components/marketing/plans";

export interface PageSeo {
  title: string;
  /** Render `title` as-is (no " · MyWebRank" suffix). */
  absolute?: boolean;
  description: string;
  /** First published (YYYY-MM-DD). */
  published?: string;
  /** Last content change (YYYY-MM-DD). */
  updated: string;
  /** Not indexable (auth pages): excluded from freshness / sitemap checks. */
  noindex?: boolean;
}

const TODAY = "2026-11-09";
const LEGAL = "2026-11-04";
const SOFTWARE_FROM = Math.min(...MARKETING_PLANS.map((p) => p.price));

export const PAGE_SEO = {
  "/": {
    title: "SEO, AEO & GEO Checker and AI Visibility Report",
    description:
      "Free website SEO report in 30 seconds. See how Google, ChatGPT, Gemini and Perplexity see your business and get your top SEO, AEO and GEO fixes.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/features": {
    title: "SEO Audit & AI Visibility Tracking Features",
    description:
      "MyWebRank features: SEO audit, AI mention tracking in ChatGPT and Gemini, competitor share of voice, a plain to-do list and fixes you approve first.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/how-it-works": {
    title: "How It Works: SEO, AEO & GEO Audit to Fixes",
    description:
      "How MyWebRank works: add your site, we check it for Google and AI, you get a plain to-do list, approve each fix, and we check again — with undo.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/services": {
    title: "SEO Company in India: SEO, AEO & GEO Services",
    description: `Done-for-you SEO, AEO and GEO services from an India-based SEO company. We fix your site and listings monthly and report results. From ${inr(SERVICE_FROM_PRICE)}/mo + GST.`,
    published: "2026-10-28",
    updated: TODAY,
  },
  "/pricing": {
    title: "Pricing: SEO Software & Done-for-You SEO Plans",
    description: `SEO software from ${inr(SOFTWARE_FROM)}/mo with a ${TRIAL_DAYS}-day free trial, or done-for-you SEO, AEO and GEO from ${inr(SERVICE_FROM_PRICE)}/mo. Prices in INR, excluding GST.`,
    published: "2026-10-28",
    updated: TODAY,
  },
  "/free-check": {
    title: "Free Website SEO Checker: SEO, AEO & GEO Report",
    description:
      "Free website SEO checker: scores your site for SEO, AEO and GEO in 30 seconds, shows if Google and ChatGPT can read it and lists your top fixes.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/tools": {
    title: "Free SEO & AI Visibility Tools, No Sign-up",
    description:
      "14 free SEO and AI tools, no sign-up: check meta tags, headings, schema, broken links, robots.txt and sitemaps, and write titles and FAQs with AI.",
    published: "2026-11-04",
    updated: TODAY,
  },
  "/tools/ai-mention-checker": {
    title: "Free AI Visibility Checker: Can ChatGPT See You?",
    description:
      "Free check: can ChatGPT, Gemini and Perplexity read your website well enough to name your business? Get a score and plain-word fixes. No sign-up.",
    published: "2026-11-04",
    updated: TODAY,
  },
  "/tools/faq-markup-maker": {
    title: "Free FAQ Schema Generator (FAQPage JSON-LD)",
    description:
      "Type your customers' questions and answers and get ready-to-paste FAQ schema (JSON-LD) that helps Google and AI tools quote you. Free, no sign-up.",
    published: "2026-11-04",
    updated: TODAY,
  },
  "/tools/ai-guide-file-maker": {
    title: "Free llms.txt Generator for Your Website",
    description:
      "Make an llms.txt AI guide file in two minutes: tell ChatGPT and other AI tools who you are and which pages matter most. Free, no sign-up needed.",
    published: "2026-11-04",
    updated: TODAY,
  },
  "/tools/meta-tag-checker": {
    title: "Free Meta Title & Description Checker",
    description:
      "Check any page's Google headline and summary for free: length, missing tags, share preview and what to change, in plain words. No sign-up needed.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/heading-checker": {
    title: "Free Heading Checker: H1 to H6 Outline",
    description:
      "See any page's heading outline (H1 to H6) for free. Spot a missing or repeated H1, skipped levels and question headings AI tools can quote. No sign-up.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/schema-checker": {
    title: "Free Schema Markup Checker (JSON-LD Test)",
    description:
      "Find the schema markup (JSON-LD) on any page and check it for free: types found, errors, missing fields and what Google and AI tools can read from it.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/robots-txt-tester": {
    title: "Free Robots.txt Tester for Google and AI",
    description:
      "Test your robots.txt for free: see which pages Googlebot, GPTBot, PerplexityBot and other crawlers may read, and test any address. No sign-up needed.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/ai-crawler-checker": {
    title: "Is My Site Blocked From AI? Free Checker",
    description:
      "Free check: are ChatGPT, Gemini, Perplexity and Claude allowed to read your website? See every AI crawler your robots.txt and pages block, and fixes.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/sitemap-checker": {
    title: "Free XML Sitemap Checker and Generator",
    description:
      "Check your XML sitemap for free: find it, count its pages, spot errors and broken entries, or make a new sitemap from a list of your page addresses.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/broken-link-checker": {
    title: "Free Broken Link Checker for Any Page",
    description:
      "Find broken links on any web page for free: we test every link on the page and list the ones that fail, redirect or time out, with what to do next.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/seo-title-generator": {
    title: "Free AI SEO Title Generator for Any Page",
    description:
      "Get 5 SEO title ideas for any page in seconds, written by AI to fit Google's limit, with your keyword first and your brand last. Free, no sign-up.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/meta-description-generator": {
    title: "Free AI Meta Description Generator",
    description:
      "Write meta descriptions that get clicks: AI drafts 5 Google summaries for your page in the right length, with a clear reason to click. Free, no sign-up.",
    published: TODAY,
    updated: TODAY,
  },
  "/tools/faq-generator": {
    title: "Free AI FAQ Generator for Your Website",
    description:
      "Turn a page or topic into real customer questions and short answers with AI, then get FAQ schema code to paste on your site. Free and no sign-up needed.",
    published: TODAY,
    updated: TODAY,
  },
  "/compare": {
    title: "Compare MyWebRank With Other SEO Tools",
    description:
      "How MyWebRank compares with Ahrefs, Semrush and SE Ranking on SEO audits, AI visibility tracking, fixes and prices in rupees. Honest, side by side.",
    published: TODAY,
    updated: TODAY,
  },
  "/compare/ahrefs": {
    title: "MyWebRank vs Ahrefs: Features and Pricing",
    description:
      "MyWebRank vs Ahrefs compared honestly: SEO audit, AI visibility, backlinks, keyword data, fixes and pricing in INR, and which one suits your business.",
    published: TODAY,
    updated: TODAY,
  },
  "/compare/semrush": {
    title: "MyWebRank vs Semrush: Features and Pricing",
    description:
      "MyWebRank vs Semrush compared honestly: site audit, AI search visibility, keyword tools, done-for-you fixes and pricing in rupees. See which fits you.",
    published: TODAY,
    updated: TODAY,
  },
  "/compare/se-ranking": {
    title: "MyWebRank vs SE Ranking: Features and Pricing",
    description:
      "MyWebRank vs SE Ranking compared: website audit, AI visibility tracking, rank tracking, fixes and INR pricing for small businesses and agencies in India.",
    published: TODAY,
    updated: TODAY,
  },
  "/compare/ahrefs-alternatives": {
    title: "Best Ahrefs Alternatives in India",
    description:
      "The best Ahrefs alternatives for Indian businesses compared: Semrush, SE Ranking, Ubersuggest, Google Search Console and MyWebRank, and who each suits.",
    published: TODAY,
    updated: TODAY,
  },
  "/blog": {
    title: "SEO, AEO & GEO Blog: News, Research, How-tos",
    description:
      "The MyWebRank blog: practical SEO, AEO and GEO advice, research and news to help your business get found on Google and recommended by ChatGPT.",
    published: "2026-11-09",
    updated: TODAY,
  },
  "/learn": {
    title: "SEO, AEO & GEO Guides for Google and AI Search",
    description:
      "Free plain-English guides to SEO, AEO and GEO: how to rank on Google, get quoted in AI Overviews and get your business mentioned by ChatGPT.",
    published: "2026-11-09",
    updated: TODAY,
  },
  "/about": {
    title: "About Us: SEO, AEO & GEO Team in India",
    description:
      "Who we are: MyWebRank is a New Delhi-based SEO, AEO and GEO company that helps small businesses get found on Google and named in AI answers.",
    published: TODAY,
    updated: TODAY,
  },
  "/docs": {
    title: "Getting Started Docs: Setup, WordPress & GitHub",
    description:
      "Set up MyWebRank: add your website, connect WordPress or GitHub, learn how approvals work, read your SEO and AI scores, and white-label reports.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/contact": {
    title: "Contact Our SEO & AI Visibility Team",
    description:
      "Contact the MyWebRank team about done-for-you SEO, agency plans for many client sites, onboarding or support. We usually reply in one business day.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/privacy": {
    title: "Privacy Policy: How We Handle Your Data",
    description:
      "How MyWebRank collects, uses and protects your personal information, who we share it with, and how to ask us to delete your data or raise a concern.",
    published: "2026-10-28",
    updated: LEGAL,
  },
  "/terms": {
    title: "Terms of Service: SEO Software & Services",
    description:
      "The terms for using MyWebRank: your account, plans and payments, fixes we make to your website with your approval, and what we can and can't promise.",
    published: "2026-10-28",
    updated: LEGAL,
  },
  // Auth pages: noindex, but they still get unique snippets (shared links, browser tabs).
  "/login": {
    title: "Log In to Your SEO & AI Visibility Dashboard",
    description:
      "Log in to MyWebRank to see your website SEO report, AI visibility in ChatGPT and Gemini, your to-do list and the fixes waiting for your approval.",
    updated: TODAY,
    noindex: true,
  },
  "/signup": {
    title: "Start Your Free SEO & AI Visibility Trial",
    description: `Create your MyWebRank account and start a ${TRIAL_DAYS}-day free trial: a full website SEO report, AI visibility tracking in ChatGPT and Gemini, and safe fixes.`,
    updated: TODAY,
    noindex: true,
  },
  "/forgot-password": {
    title: "Forgot Your Password? Reset Your Login",
    description:
      "Forgot your MyWebRank password? Enter your account email and we'll send you a secure link to set a new password and get back to your reports.",
    updated: TODAY,
    noindex: true,
  },
  "/reset-password": {
    title: "Set a New Password for Your Account",
    description:
      "Choose a new password for your MyWebRank account using the secure link from your email, then log in to your SEO and AI visibility reports.",
    updated: TODAY,
    noindex: true,
  },
  "/accept-invite": {
    title: "Accept Your Team Invitation",
    description:
      "You've been invited to a MyWebRank workspace. Accept the invitation to join your team and see its website SEO reports and AI visibility checks.",
    updated: TODAY,
    noindex: true,
  },
} satisfies Record<string, PageSeo>;

export type StaticPath = keyof typeof PAGE_SEO;

/** Last content change per indexable static page (sitemap lastmod, WebPage.dateModified). */
export const PAGE_UPDATED: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_SEO as Record<string, PageSeo>)
    .filter(([, p]) => !p.noindex)
    .map(([path, p]) => [path, p.updated]),
);
