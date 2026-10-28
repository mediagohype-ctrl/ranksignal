// Our own SEO / AEO / GEO surface: sitemap entries, robots rules and llms.txt (pure builders, tested).
import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export function siteBase(appUrl: string = BRAND.appUrl): string {
  return appUrl.replace(/\/+$/, "");
}

export interface MarketingRoute {
  path: string;
  title: string;
  summary: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
  /** Listed in llms.txt under this section ("Optional" = can be skipped by LLMs with short context). */
  section: "Product" | "Docs" | "Optional";
}

export const MARKETING_ROUTES: MarketingRoute[] = [
  { path: "/", title: "Home", summary: "What the product does: SEO, AEO and GEO report, AI visibility measurement and approval-gated fixes.", changeFrequency: "weekly", priority: 1, section: "Product" },
  { path: "/free-check", title: "Free AI-readiness check", summary: "Free, no-sign-up tool that scores a website's homepage and key pages for SEO, AEO and GEO in about 20 seconds.", changeFrequency: "monthly", priority: 0.9, section: "Product" },
  { path: "/features", title: "Features", summary: "Site audit, AI visibility tracking across ChatGPT, Gemini, Perplexity and Google AI Overviews, recommendations and safe publishing.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/how-it-works", title: "How it works", summary: "The workflow: connect a site, audit, measure AI answers, review fixes, approve, publish, roll back and re-measure.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/services", title: "Done-for-you services", summary: "Managed AI visibility service: our team ships agreed fixes every month and sends a monthly impact report. Fix, Grow and Authority tiers from ₹19,999/month plus GST; delivery guaranteed, rankings never promised.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/pricing", title: "Pricing", summary: "Self-serve Starter, Growth and Agency software plans with a free trial, plus done-for-you service tiers, in Indian rupees excluding GST.", changeFrequency: "monthly", priority: 0.8, section: "Product" },
  { path: "/docs", title: "Getting started", summary: "Onboarding, connecting WordPress, the approval policy and known limitations.", changeFrequency: "monthly", priority: 0.7, section: "Docs" },
  { path: "/contact", title: "Contact", summary: "Contact form for agency plans, questions and support.", changeFrequency: "yearly", priority: 0.5, section: "Docs" },
  { path: "/privacy", title: "Privacy policy (draft)", summary: "How customer data is handled.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
  { path: "/terms", title: "Terms of service (draft)", summary: "Terms of use.", changeFrequency: "yearly", priority: 0.2, section: "Optional" },
];

export function buildSitemap(base = siteBase(), lastModified = new Date()): MetadataRoute.Sitemap {
  return MARKETING_ROUTES.map((r) => ({
    url: r.path === "/" ? `${base}/` : `${base}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}

/** AI crawlers we explicitly welcome (we sell AI visibility, so we practise it). */
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
  "Applebot-Extended",
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

/** llms.txt (https://llmstxt.org): H1 name, blockquote summary, details, then H2 link lists. */
export function buildLlmsTxt(base = siteBase()): string {
  const link = (r: MarketingRoute) => `- [${r.title}](${base}${r.path === "/" ? "/" : r.path}): ${r.summary}`;
  const section = (name: MarketingRoute["section"]) => [`## ${name}`, "", ...MARKETING_ROUTES.filter((r) => r.section === name).map(link)].join("\n");
  return [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.name} is a web app for small businesses and agencies that checks how search engines and AI assistants (ChatGPT, Gemini, Perplexity, Google AI Overviews) see a brand. It audits a website for SEO, answer-engine optimisation (AEO) and generative-engine optimisation (GEO), measures how often AI answers mention and cite the brand, explains each problem in plain English with step-by-step fixes, and can publish approved low-risk changes with rollback.`,
    "",
    "Key facts:",
    "",
    "- Scores: four pillars (SEO, AEO, GEO, Brand), each 0–100 with a letter grade, computed from crawled pages and sampled AI answers.",
    "- AI visibility is reported as rates over many sampled answers with the sample size shown; results are measured, not guaranteed.",
    "- Changes to a customer's website are only published after approval of the exact draft, and every change can be rolled back.",
    `- A free AI-readiness check (no sign-up) is available at ${base}/free-check.`,
    `- Two ways to buy: self-serve software plans (with a free trial) or a done-for-you service where the team ships fixes monthly and reports the impact (${base}/services). Prices are in Indian rupees, excluding GST. Contact: ${BRAND.supportEmail}.`,
    "",
    section("Product"),
    "",
    section("Docs"),
    "",
    section("Optional"),
    "",
  ].join("\n");
}
