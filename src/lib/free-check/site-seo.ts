// Our own SEO / AEO / GEO surface: sitemap entries, robots rules, llms.txt and llms-full.txt (pure builders, tested).
import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { ARTICLES, articleToMarkdown } from "@/lib/learn/articles";
import { HINDI_ARTICLES } from "@/lib/learn/hi";
import { PAGE_UPDATED } from "@/lib/seo/pages";
import { hreflangFor } from "@/components/marketing/hi/pairs";

export function siteBase(appUrl: string = BRAND.appUrl): string {
  return appUrl.replace(/\/+$/, "");
}

/**
 * Last real content change of the marketing pages. Bump it when you edit page copy — a lastmod that
 * changes on every request (new Date()) teaches Google to ignore it.
 */
export const MARKETING_UPDATED = "2026-11-09";

export interface MarketingRoute {
  path: string;
  title: string;
  summary: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
  /** Listed in llms.txt under this section ("Optional" = can be skipped by LLMs with short context). */
  section: "Product" | "Guides" | "Blog" | "Docs" | "Optional" | "Hindi";
  /** YYYY-MM-DD of the last content change (static pages: PAGE_UPDATED in src/lib/seo/pages.ts; else MARKETING_UPDATED). */
  updated?: string;
}

const STATIC_ROUTE_LIST: MarketingRoute[] = [
  { path: "/", title: "Home", summary: "SEO, AEO and GEO platform: website SEO report, AI visibility tracking in ChatGPT, Gemini, Perplexity and Claude, and approval-gated fixes.", changeFrequency: "weekly", priority: 1, section: "Product" },
  { path: "/free-check", title: "Free website SEO checker", summary: "Free, no-sign-up SEO, AEO and GEO checker that scores a website's homepage and key pages in about 30 seconds and lists the top fixes.", changeFrequency: "monthly", priority: 0.9, section: "Product" },
  { path: "/features", title: "Features", summary: "What MyWebRank does, in four parts: a weekly website check, AI answer checks in ChatGPT, Gemini and Perplexity, ready-to-paste fixes with step-by-step help, and a monthly report.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/how-it-works", title: "How it works", summary: "Three steps: check the website and AI answers, fix what matters most (you make the change with our steps, or our team does it for you), and see what changed in a monthly report.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/done-for-you", title: "SEO, AEO & GEO services (done for you)", summary: "Done-for-you SEO, AEO and GEO service from an India-based team (\"Do it for me\"): the team makes the fixes on the website, Google Business Profile and listings every month and sends a monthly report. ₹19,999/month, no setup fee; the work is promised, rankings never are.", changeFrequency: "monthly", priority: 0.9, section: "Product" },
  { path: "/pricing", title: "Pricing", summary: "Three ways to buy, in Indian rupees: Do it myself (software with a free trial; it shows exactly what to change and the owner makes the changes), Do it for me (the team changes the website) and Custom.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/tools", title: "Free SEO and AI tools", summary: "Free SEO and AI tools, no sign-up: website check, meta tag, heading, schema, broken link, robots.txt, AI crawler and sitemap checkers, and title, meta description, FAQ, FAQ schema and llms.txt generators.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/ai-visibility-checker", title: "AI visibility checker", summary: "Free AI visibility checker: asks ChatGPT, Gemini and Perplexity a customer-style question and shows whether each names your business and who is named instead.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/features/ai-visibility-tracking", title: "AI visibility tracking", summary: "Weekly AI visibility tracking and brand monitoring: how often ChatGPT, Gemini and Perplexity name a business, who they name instead, and what to fix.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/seo-services-small-business", title: "SEO services for small businesses in India", summary: "SEO for Indian small businesses: a free website check, SEO audit software from ₹1,999 a month, or the team does the work for you.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/tools/faq-schema-generator", title: "FAQ schema generator", summary: "Free FAQ schema (FAQPage JSON-LD) generator for Google rich results and AI answers.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/llms-txt-generator", title: "llms.txt generator", summary: "Free llms.txt generator that tells AI tools what your website is about.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/meta-tag-checker", title: "Meta title & description checker", summary: "Free checker for a page's title tag, meta description and share preview, with fixes.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/heading-checker", title: "Heading structure checker", summary: "Free H1-H6 heading outline checker for any web page.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/schema-checker", title: "Schema markup checker", summary: "Free JSON-LD / schema.org structured data checker for any web page.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/robots-txt-tester", title: "Robots.txt tester", summary: "Free robots.txt tester for Googlebot and AI crawlers.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/ai-crawler-checker", title: "AI crawler access checker", summary: "Free check of whether AI crawlers (GPTBot, Google-Extended, PerplexityBot, ClaudeBot) can read a site.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/sitemap-checker", title: "XML sitemap checker & generator", summary: "Free XML sitemap checker and generator.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/broken-link-checker", title: "Broken link checker", summary: "Free broken link checker that tests every link on a web page.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/seo-title-generator", title: "SEO title generator", summary: "Free AI SEO title (title tag) generator.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/meta-description-generator", title: "Meta description generator", summary: "Free AI meta description generator.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/faq-generator", title: "AI FAQ generator", summary: "Free AI FAQ generator that drafts questions, answers and FAQPage schema.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/compare", title: "Compare SEO tools", summary: "How MyWebRank compares with Ahrefs, Semrush and SE Ranking.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/ahrefs", title: "MyWebRank vs Ahrefs", summary: "Side-by-side comparison of MyWebRank and Ahrefs.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/semrush", title: "MyWebRank vs Semrush", summary: "Side-by-side comparison of MyWebRank and Semrush.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/se-ranking", title: "MyWebRank vs SE Ranking", summary: "Side-by-side comparison of MyWebRank and SE Ranking.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/ahrefs-alternatives", title: "Best Ahrefs alternatives in India", summary: "Ahrefs alternatives for Indian businesses compared, including free options.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/semrush-alternatives", title: "Best Semrush alternatives in India", summary: "Semrush alternatives for Indian businesses compared on price, AI visibility tracking and ease of use.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/compare/se-ranking-alternatives", title: "Best SE Ranking alternatives in India", summary: "SE Ranking alternatives for Indian businesses compared on price, AI visibility tracking and ease of use.", changeFrequency: "monthly", priority: 0.6, section: "Product" },
  { path: "/blog", title: "Blog", summary: "News, research and how-tos on SEO, AEO and GEO from the MyWebRank team.", changeFrequency: "weekly", priority: 0.8, section: "Blog" },
  { path: "/learn", title: "SEO, AEO & GEO guides", summary: "Plain-English guides to ranking on Google and getting mentioned in AI answers.", changeFrequency: "weekly", priority: 0.8, section: "Guides" },
  { path: "/author/shubhankar-gupta", title: "Shubhankar Gupta (author)", summary: "Author page for Shubhankar Gupta, who writes MyWebRank's SEO, AEO and GEO guides.", changeFrequency: "monthly", priority: 0.4, section: "Docs" },
  { path: "/about", title: "About us", summary: "Who runs MyWebRank: the India-based SEO, AEO and GEO team behind the product and service, and how to reach us.", changeFrequency: "monthly", priority: 0.6, section: "Docs" },
  { path: "/docs", title: "Getting started", summary: "Getting started, how fixes work on each offer, how approvals and connections work when our team does the work, check schedules, method and known limitations.", changeFrequency: "monthly", priority: 0.6, section: "Docs" },
  { path: "/docs/api", title: "API and MCP docs", summary: "Read-only REST API v1, MCP server for AI assistants and a Looker Studio connector for MyWebRank data, authenticated with API keys.", changeFrequency: "monthly", priority: 0.5, section: "Docs" },
  { path: "/contact", title: "Contact", summary: "Contact form for Custom plans, free calls, questions and support.", changeFrequency: "yearly", priority: 0.5, section: "Docs" },
  { path: "/privacy", title: "Privacy policy", summary: "How customer data is handled.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
  { path: "/terms", title: "Terms of service", summary: "Terms of use.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
  // Hindi versions (hreflang pairs in src/components/marketing/hi/pairs.ts).
  { path: "/hi", title: "होम (Hindi home page)", summary: "Hindi version of the home page: the free SEO, AEO and GEO website check, the three steps and the plans in rupees.", changeFrequency: "monthly", priority: 0.7, section: "Hindi" },
  { path: "/hi/free-check", title: "फ्री वेबसाइट SEO चेकर (Hindi)", summary: "Hindi page for the free website SEO, AEO and GEO checker, with the result and fixes in Hindi.", changeFrequency: "monthly", priority: 0.6, section: "Hindi" },
  { path: "/hi/services", title: "SEO, AEO और GEO सेवाएँ (Hindi)", summary: "Hindi page for the done-for-you SEO, AEO and GEO service (Do it for me), in rupees.", changeFrequency: "monthly", priority: 0.6, section: "Hindi" },
  { path: "/hi/pricing", title: "कीमतें (Hindi pricing)", summary: "Hindi pricing page: Do it myself (software with a free trial), Do it for me and Custom, in rupees.", changeFrequency: "monthly", priority: 0.6, section: "Hindi" },
  { path: "/hi/about", title: "हमारे बारे में (Hindi about page)", summary: "Hindi page about the India-based MyWebRank team, what it does and how it measures websites.", changeFrequency: "monthly", priority: 0.5, section: "Hindi" },
  { path: "/hi/contact", title: "संपर्क करें (Hindi contact page)", summary: "Hindi contact page for the MyWebRank team.", changeFrequency: "yearly", priority: 0.4, section: "Hindi" },
];

/** Each static page's lastmod comes from the same map as its WebPage.dateModified (src/lib/seo/pages.ts). */
const STATIC_ROUTES: MarketingRoute[] = STATIC_ROUTE_LIST.map((r) => ({ ...r, updated: PAGE_UPDATED[r.path] ?? r.updated }));

const ARTICLE_ROUTES: MarketingRoute[] = ARTICLES.map((a) => ({
  path: `/learn/${a.slug}`,
  title: a.title,
  summary: a.description,
  changeFrequency: "monthly",
  priority: 0.7,
  section: "Guides",
  updated: a.updated,
}));

const HINDI_ARTICLE_ROUTES: MarketingRoute[] = HINDI_ARTICLES.map((a) => ({
  path: `/hi/learn/${a.slug}`,
  title: a.title,
  summary: a.description,
  changeFrequency: "monthly",
  priority: 0.6,
  section: "Hindi",
  updated: a.updated,
}));

export const MARKETING_ROUTES: MarketingRoute[] = [...STATIC_ROUTES, ...ARTICLE_ROUTES, ...HINDI_ARTICLE_ROUTES];

const urlFor = (base: string, path: string) => (path === "/" ? `${base}/` : `${base}${path}`);

/** Published blog posts as routes (sitemap + llms.txt). */
export function blogRoutes(posts: { slug: string; title: string; description: string; updatedAt: Date }[]): MarketingRoute[] {
  // Titles/summaries come from the database: keep llms.txt's "- [title](url): summary" lines well-formed.
  const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
  return posts.map((p) => ({
    path: `/blog/${p.slug}`,
    title: oneLine(p.title).replace(/[[\]]/g, ""),
    summary: oneLine(p.description),
    changeFrequency: "monthly",
    priority: 0.7,
    section: "Blog",
    updated: p.updatedAt.toISOString().slice(0, 10),
  }));
}

/**
 * `lastModified` overrides every entry's date (tests); otherwise each route's real last-change date is used.
 * `extra` = dynamic routes (published blog posts).
 */
export function buildSitemap(base = siteBase(), lastModified?: Date, extra: MarketingRoute[] = []): MetadataRoute.Sitemap {
  return [...MARKETING_ROUTES, ...extra].map((r) => {
    // English ↔ Hindi pairs carry reciprocal hreflang alternates (<xhtml:link>) in the sitemap too.
    const langs = hreflangFor(r.path);
    return {
      url: urlFor(base, r.path),
      lastModified: lastModified ?? new Date(`${r.updated ?? MARKETING_UPDATED}T00:00:00Z`),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      ...(langs
        ? { alternates: { languages: Object.fromEntries(Object.entries(langs).map(([l, p]) => [l, urlFor(base, p)])) } }
        : {}),
    };
  });
}

/** Every public URL, for IndexNow submissions. */
export function publicUrls(base = siteBase(), extra: MarketingRoute[] = []): string[] {
  return [...MARKETING_ROUTES, ...extra].map((r) => urlFor(base, r.path));
}

/** AI and answer-engine crawlers we explicitly welcome (we sell AI visibility, so we practise it). */
export const WELCOMED_AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "MistralAI-User",
  "meta-externalagent",
  "Amazonbot",
  "CCBot",
] as const;

/** "/app" alone would also match "/apple-icon" (robots rules are prefix matches), hence "/app$" + "/app/". */
export const PRIVATE_PATHS = ["/app$", "/app/", "/admin", "/api/"];

export function buildRobots(base = siteBase()): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Named groups: a bot that matches its own group ignores "*", so repeat the disallows.
      { userAgent: [...WELCOMED_AI_BOTS], allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

const SUMMARY = `${BRAND.name} is an SEO, AEO and GEO platform and done-for-you service for small businesses and agencies, based in India. It checks how search engines and AI assistants (ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overviews) see a brand: it audits a website for search engine optimisation (SEO), answer-engine optimisation (AEO) and generative-engine optimisation (GEO), measures how often AI answers mention and cite the brand, and explains each problem in plain English with ready-to-paste, step-by-step fixes. On the done-for-you service the team makes the changes on the customer's website, with the customer's approval.`;

function keyFacts(base: string): string[] {
  return [
    "- Category: SEO software, website SEO report and audit tool, AI search visibility tracker, and SEO/AEO/GEO agency service.",
    "- Scores: four pillars (SEO, AEO, GEO, Brand), each 0–100 with a letter grade, computed from crawled pages and sampled AI answers.",
    "- AI visibility is reported as rates over many sampled answers with the sample size shown; results are measured, not guaranteed.",
    "- Nothing on a customer's website changes without the customer: on the self-serve plan (Do it myself) the owner makes every change by hand from ready-to-paste fixes; on the done-for-you service (Do it for me) the team makes the changes after the customer's approval.",
    `- A free website SEO, AEO and GEO check (no sign-up) is available at ${base}/free-check.`,
    `- Who runs ${BRAND.name}, and how to contact the team: ${base}/about and ${base}/contact.`,
    `- Two ways to buy: self-serve software plans (with a free trial) or a done-for-you service where the team ships fixes monthly and reports the impact (${base}/done-for-you). Prices are in Indian rupees, excluding GST. Contact: ${BRAND.supportEmail}.`,
  ];
}

/** llms.txt (https://llmstxt.org): H1 name, blockquote summary, details, then H2 link lists. */
export function buildLlmsTxt(base = siteBase(), extra: MarketingRoute[] = []): string {
  const routes = [...MARKETING_ROUTES, ...extra];
  const link = (r: MarketingRoute) => `- [${r.title}](${urlFor(base, r.path)}): ${r.summary}`;
  const section = (name: MarketingRoute["section"]) =>
    [`## ${name}`, "", ...routes.filter((r) => r.section === name).map(link)].join("\n");
  return [
    `# ${BRAND.name}`,
    "",
    `> ${SUMMARY}`,
    "",
    "Key facts:",
    "",
    ...keyFacts(base),
    `- Full text of the guides in one file: ${base}/llms-full.txt`,
    "",
    section("Product"),
    "",
    section("Guides"),
    "",
    section("Blog"),
    "",
    section("Docs"),
    "",
    section("Hindi"),
    "",
    section("Optional"),
    "",
  ].join("\n");
}

/** llms-full.txt: the summary plus the complete text of every guide, so AI tools can read it in one fetch. */
/** `extraDocs` = Markdown of published blog posts, appended after the guides. */
export function buildLlmsFullTxt(base = siteBase(), extraDocs: string[] = []): string {
  return [
    `# ${BRAND.name}`,
    "",
    `> ${SUMMARY}`,
    "",
    ...keyFacts(base),
    "",
    "---",
    "",
    ...ARTICLES.flatMap((a) => [articleToMarkdown(a, base), "---", ""]),
    ...extraDocs.flatMap((d) => [d, "---", ""]),
  ].join("\n");
}
