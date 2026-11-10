// Shared limits and wording for the MyWebRank SEO extension.
//
// These numbers are COPIED from the website so the extension and the full report never disagree:
//   TITLE_MIN, TITLE_MAX, DESCRIPTION_MAX, THIN_WORDS  -> src/lib/audit/rules.ts
//   TITLE_SHORT, DESCRIPTION_SHORT                     -> src/lib/tools/meta-tags.ts
//   QUESTION_START                                     -> src/lib/crawler/extract.ts
//   AI_BOTS                                            -> src/lib/audit/ai-bots.ts
// If you change them there, change them here too (tests/extension/constants.test.ts checks they match).

export const TITLE_MIN = 10;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;
export const THIN_WORDS = 300;
/** A title under this many characters usually wastes space Google would show (warn, not fail). */
export const TITLE_SHORT = 30;
/** A summary under this many characters usually says too little to earn the click. */
export const DESCRIPTION_SHORT = 70;

export const QUESTION_START = /^(what|how|why|when|where|which|who|can|could|does|do|did|is|are|should|will|would)\b/i;

/** @typedef {"search" | "user" | "training"} AiBotPurpose */
/** @type {{ token: string; owner: string; purpose: AiBotPurpose; label: string }[]} */
export const AI_BOTS = [
  { token: "OAI-SearchBot", owner: "OpenAI", purpose: "search", label: "ChatGPT search" },
  { token: "ChatGPT-User", owner: "OpenAI", purpose: "user", label: "ChatGPT browsing on a user's request" },
  { token: "GPTBot", owner: "OpenAI", purpose: "training", label: "OpenAI model training" },
  { token: "PerplexityBot", owner: "Perplexity", purpose: "search", label: "Perplexity search" },
  { token: "Perplexity-User", owner: "Perplexity", purpose: "user", label: "Perplexity on a user's request" },
  { token: "Claude-SearchBot", owner: "Anthropic", purpose: "search", label: "Claude search" },
  { token: "ClaudeBot", owner: "Anthropic", purpose: "training", label: "Anthropic model training" },
  { token: "Google-Extended", owner: "Google", purpose: "training", label: "Gemini training/grounding opt-out" },
  { token: "Applebot-Extended", owner: "Apple", purpose: "training", label: "Apple AI training" },
  { token: "CCBot", owner: "Common Crawl", purpose: "training", label: "Common Crawl (used to train many models)" },
];

export const SITE_URL = "https://mywebrank.tech";

/** Free tools on the website that go deeper on one check. */
export const TOOL_LINKS = {
  meta: { path: "/tools/meta-tag-checker", label: "Meta tag checker" },
  headings: { path: "/tools/heading-checker", label: "Heading checker" },
  schema: { path: "/tools/schema-checker", label: "Schema checker" },
  links: { path: "/tools/broken-link-checker", label: "Broken link checker" },
  aiCrawlers: { path: "/tools/ai-crawler-checker", label: "AI crawler checker" },
  robots: { path: "/tools/robots-txt-tester", label: "Robots.txt tester" },
  llms: { path: "/tools/ai-guide-file-maker", label: "llms.txt generator" },
  faq: { path: "/tools/faq-markup-maker", label: "FAQ schema generator" },
};

/** Full free-check link for a page's origin. Only http(s) origins are accepted. */
export function freeCheckUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return `${SITE_URL}/free-check`;
    return `${SITE_URL}/free-check?url=${encodeURIComponent(u.origin)}`;
  } catch {
    return `${SITE_URL}/free-check`;
  }
}

/** Absolute link to a free tool page (no tracking parameters). */
export function toolUrl(path) {
  return `${SITE_URL}${path}`;
}
