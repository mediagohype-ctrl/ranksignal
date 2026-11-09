// Our own SEO / AEO / GEO surface: sitemap entries, robots rules, llms.txt and llms-full.txt (pure builders, tested).
import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { ARTICLES, articleToMarkdown } from "@/lib/learn/articles";
import { PAGE_UPDATED } from "@/lib/seo/pages";

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
  section: "Product" | "Guides" | "Blog" | "Docs" | "Optional";
  /** YYYY-MM-DD of the last content change (static pages: PAGE_UPDATED in src/lib/seo/pages.ts; else MARKETING_UPDATED). */
  updated?: string;
}

const STATIC_ROUTE_LIST: MarketingRoute[] = [
  { path: "/", title: "Home", summary: "SEO, AEO and GEO platform: website SEO report, AI visibility tracking in ChatGPT, Gemini, Perplexity and Claude, and approval-gated fixes.", changeFrequency: "weekly", priority: 1, section: "Product" },
  { path: "/free-check", title: "Free website SEO checker", summary: "Free, no-sign-up SEO, AEO and GEO checker that scores a website's homepage and key pages in about 30 seconds and lists the top fixes.", changeFrequency: "monthly", priority: 0.9, section: "Product" },
  { path: "/features", title: "Features", summary: "SEO audit, AI visibility tracking across ChatGPT, Gemini, Perplexity and Google AI Overviews, competitor share of voice, recommendations and safe publishing.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/how-it-works", title: "How it works", summary: "The workflow: connect a site, audit, measure AI answers, review fixes, approve, publish, roll back and re-measure.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/services", title: "SEO, AEO & GEO services (done for you)", summary: "Managed SEO, AEO and GEO service from an India-based team: we ship agreed fixes every month and send a monthly impact report. Fix, Grow and Authority tiers from ₹19,999/month plus GST; delivery guaranteed, rankings never promised.", changeFrequency: "monthly", priority: 0.9, section: "Product" },
  { path: "/pricing", title: "Pricing", summary: "Self-serve Starter, Growth and Agency software plans with a free trial, plus done-for-you service tiers, in Indian rupees excluding GST.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/tools", title: "Free SEO and AI tools", summary: "Free tools: AI visibility checker, FAQ schema generator and llms.txt generator.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/ai-mention-checker", title: "AI visibility checker", summary: "Free check of whether ChatGPT, Gemini and Perplexity can read and recommend your website.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/faq-markup-maker", title: "FAQ schema generator", summary: "Free FAQ schema (FAQPage JSON-LD) generator for Google rich results and AI answers.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/tools/ai-guide-file-maker", title: "llms.txt generator", summary: "Free llms.txt generator that tells AI tools what your website is about.", changeFrequency: "monthly", priority: 0.7, section: "Product" },
  { path: "/blog", title: "Blog", summary: "News, research and how-tos on SEO, AEO and GEO from the MyWebRank team.", changeFrequency: "weekly", priority: 0.8, section: "Blog" },
  { path: "/learn", title: "SEO, AEO & GEO guides", summary: "Plain-English guides to ranking on Google and getting mentioned in AI answers.", changeFrequency: "weekly", priority: 0.8, section: "Guides" },
  { path: "/about", title: "About us", summary: "Who runs MyWebRank: the India-based SEO, AEO and GEO team behind the product and service, and how to reach us.", changeFrequency: "monthly", priority: 0.6, section: "Docs" },
  { path: "/docs", title: "Getting started", summary: "Onboarding, connecting WordPress, the approval policy and known limitations.", changeFrequency: "monthly", priority: 0.6, section: "Docs" },
  { path: "/contact", title: "Contact", summary: "Contact form for agency plans, questions and support.", changeFrequency: "yearly", priority: 0.5, section: "Docs" },
  { path: "/privacy", title: "Privacy policy", summary: "How customer data is handled.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
  { path: "/terms", title: "Terms of service", summary: "Terms of use.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
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

export const MARKETING_ROUTES: MarketingRoute[] = [...STATIC_ROUTES, ...ARTICLE_ROUTES];

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
  return [...MARKETING_ROUTES, ...extra].map((r) => ({
    url: urlFor(base, r.path),
    lastModified: lastModified ?? new Date(`${r.updated ?? MARKETING_UPDATED}T00:00:00Z`),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
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

const SUMMARY = `${BRAND.name} is an SEO, AEO and GEO platform and done-for-you service for small businesses and agencies, based in India. It checks how search engines and AI assistants (ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overviews) see a brand: it audits a website for search engine optimisation (SEO), answer-engine optimisation (AEO) and generative-engine optimisation (GEO), measures how often AI answers mention and cite the brand, explains each problem in plain English with step-by-step fixes, and can publish approved low-risk changes with rollback.`;

function keyFacts(base: string): string[] {
  return [
    "- Category: SEO software, website SEO report and audit tool, AI search visibility tracker, and SEO/AEO/GEO agency service.",
    "- Scores: four pillars (SEO, AEO, GEO, Brand), each 0–100 with a letter grade, computed from crawled pages and sampled AI answers.",
    "- AI visibility is reported as rates over many sampled answers with the sample size shown; results are measured, not guaranteed.",
    "- Changes to a customer's website are only published after approval of the exact draft, and every change can be rolled back.",
    `- A free website SEO, AEO and GEO check (no sign-up) is available at ${base}/free-check.`,
    `- Who runs ${BRAND.name}, and how to contact the team: ${base}/about and ${base}/contact.`,
    `- Two ways to buy: self-serve software plans (with a free trial) or a done-for-you service where the team ships fixes monthly and reports the impact (${base}/services). Prices are in Indian rupees, excluding GST. Contact: ${BRAND.supportEmail}.`,
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
