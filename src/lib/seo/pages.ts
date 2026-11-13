// Search snippets (title + description) and freshness dates for every static page on our own site.
// One registry so titles and descriptions stay unique and inside Google's limits (tests/seo/page-meta.test.ts).
//
// - `title` is the page part; the root layout appends " · MyWebRank" (TITLE_SUFFIX) unless `absolute` is set.
//   The FULL rendered title must be 30–60 characters, keyword first, brand last.
// - `description` must be 120–155 characters and unique.
// - `updated` (YYYY-MM-DD) is the last real content change: it feeds the sitemap lastmod, WebPage.dateModified
//   and the visible freshness signals. Bump it when you change a page's copy — never set it to "today" on every request.
import { DFY_PLAN, SELF_PLAN, TRIAL_DAYS, inr, inrGst, priceNote } from "@/components/marketing/plans";

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
  /** Page language (BCP 47). Defaults to "en-IN"; the Hindi pages under /hi set "hi-IN". */
  lang?: "en-IN" | "hi-IN";
  /**
   * hreflang alternates (language → site-relative path). Optional: when absent, staticPageMetadata derives it from
   * the English ↔ Hindi pairs in src/components/marketing/hi/pairs.ts (hreflangFor).
   */
  hreflang?: Record<string, string>;
}

const TODAY = "2026-11-09";
const LEGAL = "2026-11-04";

export const PAGE_SEO = {
  "/": {
    title: "Free SEO & AI Visibility Checker",
    description:
      "See if Google and ChatGPT can find your business. Get your free Found Score and 3 easy fixes in 30 seconds. No sign-up needed.",
    published: "2026-10-28",
    updated: "2026-11-13",
  },
  "/features": {
    title: "SEO Audit & AI Visibility Tracking Features",
    description:
      "MyWebRank features: SEO audit, AI mention tracking in ChatGPT and Gemini, competitor share of voice, a plain to-do list and fixes you approve first.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/how-it-works": {
    title: "How It Works: Check, Fix, Grow Every Month",
    description:
      "We check your site, you approve each fix, and we report what changed every month. Every change can be undone in one click. Start free.",
    published: "2026-10-28",
    updated: "2026-11-13",
  },
  "/services": {
    title: "SEO, AEO & GEO Services in India",
    description: `Our team fixes your website, Google profile and AI visibility every month. You approve every change. From ${inrGst(DFY_PLAN.price)}/month.`,
    published: "2026-10-28",
    updated: "2026-11-13",
  },
  "/pricing": {
    title: `SEO Software Pricing in India from ${inr(SELF_PLAN.price)}`,
    description: `Simple plans in rupees. Software from ${inr(SELF_PLAN.price)}/month or done-for-you SEO from ${inr(DFY_PLAN.price)}/month. ${TRIAL_DAYS}-day free trial, no setup fee.`,
    published: "2026-10-28",
    updated: "2026-11-13",
  },
  "/free-check": {
    title: "Free Website SEO Checker: Google + AI Report",
    description:
      "Check your website free. See your SEO, AEO, GEO and Brand scores and the 3 fixes that matter most. Takes about 30 seconds, no sign-up.",
    published: "2026-10-28",
    updated: "2026-11-13",
  },
  "/tools": {
    title: "Free SEO Tools for Google and AI Search",
    description:
      "Free SEO tools, no sign-up: check titles, headings, schema, broken links, robots.txt and AI crawler access in seconds, then fix what you find.",
    published: "2026-11-04",
    updated: "2026-11-13",
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
      "Make an llms.txt file in 2 minutes. Tell ChatGPT and other AI tools who you are and which pages matter most. Free, and no sign-up needed.",
    published: "2026-11-04",
    updated: "2026-11-13",
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
    title: "AI Crawler Checker: Is ChatGPT Blocked?",
    description:
      "Check if ChatGPT, Gemini, Claude and Perplexity can read your website. See which AI robots are blocked. Free, no sign-up, results in seconds.",
    published: TODAY,
    updated: "2026-11-13",
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
    title: "MyWebRank vs Ahrefs: Honest Comparison (2026)",
    absolute: true,
    description: `Ahrefs is great for backlinks. MyWebRank finds and fixes problems and tracks AI answers, from ${inr(SELF_PLAN.price)}. See which fits you.`,
    published: TODAY,
    updated: "2026-11-13",
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
  "/tools/seo-extension": {
    title: "Free SEO Browser Extension for Chrome and Edge",
    description:
      "Check any page's SEO and AI readiness in one click: titles, headings, schema, share tags and AI robot rules. Runs in your browser. Free, no sign-up.",
    published: "2026-11-10",
    updated: "2026-11-10",
  },
  "/docs/api": {
    title: "API, MCP server and Looker Studio guide",
    description:
      "Read your MyWebRank scores, issues, AI visibility and Search Console data with a read-only REST API, an MCP server for AI tools and Looker Studio.",
    published: "2026-11-10",
    updated: "2026-11-10",
  },
  "/blog": {
    title: "SEO, AEO & GEO Blog: News, Research, How-tos",
    description:
      "The MyWebRank blog: practical SEO, AEO and GEO advice, research and news to help your business get found on Google and recommended by ChatGPT.",
    published: "2026-11-09",
    updated: TODAY,
  },
  "/learn": {
    title: "Learn SEO, AEO & GEO in Plain Words",
    description:
      "Short, simple guides to get your business found on Google and named by ChatGPT, Gemini and Perplexity. Written in plain words for owners.",
    published: "2026-11-09",
    updated: "2026-11-13",
  },
  "/about": {
    title: "About MyWebRank: SEO & AI Visibility Team in India",
    absolute: true,
    description:
      "Meet the team behind MyWebRank. 10,000+ businesses served by our team. We help businesses get found on Google and named by AI like ChatGPT.",
    published: TODAY,
    updated: "2026-11-13",
  },
  "/docs": {
    title: "Getting Started Docs: Setup, WordPress & GitHub",
    description:
      "Set up MyWebRank: add your website, connect WordPress or GitHub, learn how approvals work, read your SEO and AI scores, and white-label reports.",
    published: "2026-10-28",
    updated: TODAY,
  },
  "/contact": {
    title: "Contact MyWebRank: Talk to a Real Person",
    absolute: true,
    description:
      "Questions about plans, agencies or your report? Email, WhatsApp or book a free call. We reply within 1 working day, in English or Hindi.",
    published: "2026-10-28",
    updated: "2026-11-13",
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
  // Hindi versions of the key pages (src/app/(marketing)/hi). Full titles count JS string length (UTF-16 code units,
  // so Devanagari vowel signs count too — stricter than what Google shows). Prices come from the same constants.
  "/hi": {
    title: "SEO, AEO और GEO चेकर: Google और AI में दिखें",
    description:
      "फ्री वेबसाइट SEO रिपोर्ट 30 सेकंड में। देखें कि Google, ChatGPT और Gemini आपके बिज़नेस को कैसे देखते हैं, और SEO, AEO, GEO के सबसे ज़रूरी सुधार पाएँ।",
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
  },
  "/hi/pricing": {
    title: "कीमतें: SEO सॉफ़्टवेयर और SEO सेवा के प्लान",
    description: `SEO सॉफ़्टवेयर ${inrGst(SELF_PLAN.price)}/महीने, ${TRIAL_DAYS} दिन फ्री ट्रायल के साथ। या हमारी टीम से SEO, AEO, GEO का पूरा काम ${inr(DFY_PLAN.price)}/महीने। ${priceNote(true)}`,
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
  },
  "/hi/services": {
    title: "भारत में SEO कंपनी: SEO, AEO और GEO सेवाएँ",
    description: `भारत की SEO टीम आपकी वेबसाइट और Google लिस्टिंग हर महीने ठीक करती है और रिपोर्ट भेजती है। SEO, AEO और GEO सेवा ${inrGst(DFY_PLAN.price)}/महीने, कोई सेटअप फ़ीस नहीं।`,
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
  },
  "/hi/free-check": {
    title: "फ्री वेबसाइट SEO चेकर: SEO, AEO, GEO रिपोर्ट",
    description:
      "फ्री वेबसाइट SEO चेकर: 30 सेकंड में SEO, AEO और GEO स्कोर देखें, जानें कि Google और ChatGPT आपकी साइट पढ़ पाते हैं या नहीं, और टॉप सुधार पाएँ।",
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
  },
  "/hi/about": {
    title: "हमारे बारे में: भारत की SEO, AEO और GEO टीम",
    description:
      "MyWebRank नई दिल्ली की SEO, AEO और GEO कंपनी है, जो छोटे बिज़नेस को Google पर मिलने और ChatGPT जैसे AI जवाबों में नाम आने में मदद करती है।",
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
  },
  "/hi/contact": {
    title: "संपर्क करें: SEO और AI विज़िबिलिटी टीम",
    description:
      "MyWebRank टीम से बात करें: SEO सेवा, कई क्लाइंट साइटों वाले एजेंसी प्लान, शुरुआत या सपोर्ट के बारे में। हम आम तौर पर एक कामकाजी दिन में जवाब देते हैं।",
    published: TODAY,
    updated: TODAY,
    lang: "hi-IN",
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
