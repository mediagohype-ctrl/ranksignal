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
      "MyWebRank features: a weekly website check, AI answers from ChatGPT, Gemini and Perplexity, ready-to-paste fixes and a simple monthly report.",
    published: "2026-10-28",
    updated: "2026-11-15",
  },
  "/how-it-works": {
    title: "How It Works: Three Steps to Get Found",
    description:
      "Three steps: we check your website and AI answers, show you exactly what to fix (or fix it for you), and report what changed. Start free.",
    published: "2026-10-28",
    updated: "2026-11-15",
  },
  // Done-for-you service (was /services until 15 Nov 2026; the old address redirects here, see next.config.ts).
  "/done-for-you": {
    title: "SEO, AEO & GEO Services in India",
    description: `Our team fixes your website, Google profile and AI visibility every month. You approve every change. From ${inrGst(DFY_PLAN.price)}/month.`,
    published: "2026-10-28",
    updated: "2026-11-15",
  },
  "/pricing": {
    title: `SEO Software Pricing in India from ${inr(SELF_PLAN.price)}`,
    description: `Simple plans in rupees. Software from ${inr(SELF_PLAN.price)}/month or done-for-you SEO from ${inr(DFY_PLAN.price)}/month. ${TRIAL_DAYS}-day free trial, no setup fee.`,
    published: "2026-10-28",
    updated: "2026-11-15",
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
    updated: "2026-11-15",
  },
  // /tools/ai-mention-checker was the same check as /free-check and now redirects there (next.config.ts).
  // The two makers below moved to the names people search for; the old addresses redirect.
  "/tools/faq-schema-generator": {
    title: "Free FAQ Schema Generator for JSON-LD",
    description:
      "Convert your existing questions and answers into FAQPage JSON-LD. Copy the structured data and add it to the page where your FAQs appear.",
    published: "2026-11-04",
    updated: "2026-11-20",
  },
  "/tools/llms-txt-generator": {
    title: "Free llms.txt Generator for Websites",
    description:
      "Create an llms.txt file with your site summary and links to key pages. Copy the formatted text and publish it at the root of your website.",
    published: "2026-11-04",
    updated: "2026-11-20",
  },
  "/tools/meta-tag-checker": {
    title: "Free Meta Tag Checker for Titles & Descriptions",
    description:
      "Check any page’s meta title and description. Find missing tags, review character counts and preview how the page could appear in Google Search.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/heading-checker": {
    title: "Free Heading Checker for H1–H6 Tags",
    description:
      "View the H1–H6 outline of any web page. Find missing or repeated H1 tags and skipped heading levels that make your content harder to navigate.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/schema-checker": {
    title: "Free Schema Markup Checker for JSON-LD",
    description:
      "Check the JSON-LD structured data on any web page. See which schema types are present and find syntax errors or missing fields to fix.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/robots-txt-tester": {
    title: "Free Robots.txt Tester for Any URL",
    description:
      "Test a URL against your robots.txt rules. See whether Googlebot or another crawler can access it and identify the rule that applies.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/ai-crawler-checker": {
    title: "Free AI Crawler Checker for Websites",
    description:
      "Check which AI crawlers your website allows or blocks. Review robots.txt rules for OpenAI, Anthropic, Perplexity and other AI platforms.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/sitemap-checker": {
    title: "Free XML Sitemap Checker & Validator",
    description:
      "Find and validate your XML sitemap, count its URLs and spot broken entries or formatting errors. Generate a new sitemap from a list of URLs.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/broken-link-checker": {
    title: "Free Broken Link Checker for Any Web Page",
    description:
      "Scan any web page for broken links, redirects and timeouts. See which URLs returned errors and which links need updating.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/seo-title-generator": {
    title: "Free SEO Title Generator for Web Pages",
    description:
      "Enter your page topic and target keyword to generate five SEO title ideas. Compare the options and choose a title that matches your content.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/meta-description-generator": {
    title: "Free AI Meta Description Generator",
    description:
      "Generate five meta description options based on your page topic and target keyword. Compare the drafts and choose the clearest summary for search.",
    published: TODAY,
    updated: "2026-11-20",
  },
  "/tools/faq-generator": {
    title: "Free AI FAQ Generator for Website Content",
    description:
      "Turn a page or topic into customer questions and concise answers. Review and edit the AI-generated FAQ draft, then copy the accompanying schema code.",
    published: TODAY,
    updated: "2026-11-20",
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
  // The extension is not in the browser stores yet: the page stays reachable (the extension's own homepage link)
  // but is hidden from Google, the sitemap and the tools list. Remove `noindex` and re-list it when it is live.
  "/tools/seo-extension": {
    title: "Free SEO Browser Extension for Chrome and Edge",
    description:
      "Check any page's SEO and AI readiness in one click: titles, headings, schema, share tags and AI robot rules. Runs in your browser. Free, no sign-up.",
    published: "2026-11-10",
    updated: "2026-11-10",
    noindex: true,
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
    title: "Getting Started Docs: Setup, Fixes and Scores",
    description:
      "Set up MyWebRank: add your website, see how fixes work on each plan, when checks run, how scores are measured and what needs your OK.",
    published: "2026-10-28",
    updated: "2026-11-15",
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
    description: `Create your MyWebRank account and start a ${TRIAL_DAYS}-day free trial: a full website SEO report, AI checks in ChatGPT and Gemini, and ready-to-paste fixes.`,
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
