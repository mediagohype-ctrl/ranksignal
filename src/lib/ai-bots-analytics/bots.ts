// Crawler catalog for AI bot visit analytics: which user agents we count, who runs them, and where (if anywhere) the
// operator publishes the IP ranges that let us confirm a visit really came from them. Pure.
import { AI_BOTS, type AiBotPurpose } from "@/lib/audit/ai-bots";

/** Operator IP-range lists we can check against (see ranges.ts). */
export type RangeSource = "openai-gptbot" | "openai-searchbot" | "openai-chatgpt-user" | "perplexity-bot" | "perplexity-user" | "googlebot" | "bingbot";

export interface TrackedBot {
  /** User-agent token, matched case-insensitively as a substring of the User-Agent header. */
  token: string;
  owner: string;
  /** "search-engine" bots are shown for comparison only. */
  purpose: AiBotPurpose | "search-engine";
  label: string;
  ranges?: RangeSource;
}

const RANGES: Record<string, RangeSource> = {
  GPTBot: "openai-gptbot",
  "OAI-SearchBot": "openai-searchbot",
  "ChatGPT-User": "openai-chatgpt-user",
  PerplexityBot: "perplexity-bot",
  "Perplexity-User": "perplexity-user",
};

/** robots.txt-only tokens: they are never sent as a User-Agent, so they can't appear in logs. */
const ROBOTS_ONLY = new Set(["Google-Extended", "Applebot-Extended"]);

export const TRACKED_BOTS: TrackedBot[] = [
  ...AI_BOTS.filter((b) => !ROBOTS_ONLY.has(b.token)).map((b) => ({ ...b, ranges: RANGES[b.token] })),
  { token: "Meta-ExternalAgent", owner: "Meta", purpose: "training", label: "Meta AI training" },
  { token: "Bytespider", owner: "ByteDance", purpose: "training", label: "ByteDance (TikTok) AI" },
  { token: "Amazonbot", owner: "Amazon", purpose: "search", label: "Amazon (Alexa answers)" },
  { token: "DuckAssistBot", owner: "DuckDuckGo", purpose: "user", label: "DuckDuckGo AI answers" },
  { token: "MistralAI-User", owner: "Mistral", purpose: "user", label: "Le Chat on a user's request" },
  { token: "Applebot", owner: "Apple", purpose: "search", label: "Apple (Siri and Spotlight)" },
  { token: "Googlebot", owner: "Google", purpose: "search-engine", label: "Google Search (also feeds AI Overviews)", ranges: "googlebot" },
  { token: "bingbot", owner: "Microsoft", purpose: "search-engine", label: "Bing (also feeds Copilot and ChatGPT search)", ranges: "bingbot" },
];

const BY_TOKEN = new Map(TRACKED_BOTS.map((b) => [b.token.toLowerCase(), b]));
// Longest token first so a more specific token wins if one ever contains another.
const MATCH_ORDER = [...TRACKED_BOTS].sort((a, b) => b.token.length - a.token.length);

/** The tracked bot named in a User-Agent header, or null. */
export function matchBot(userAgent: string | null | undefined): TrackedBot | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const b of MATCH_ORDER) if (ua.includes(b.token.toLowerCase())) return b;
  return null;
}

export function botByToken(token: string): TrackedBot | null {
  return BY_TOKEN.get(token.toLowerCase()) ?? null;
}

/** True for AI crawlers (everything except the classic search engines shown for comparison). */
export function isAiBot(token: string): boolean {
  const b = botByToken(token);
  return !!b && b.purpose !== "search-engine";
}

/** Regex source used by the Cloudflare Worker snippet to forward only these crawlers. */
export function botUserAgentPattern(): string {
  return MATCH_ORDER.map((b) => b.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}
