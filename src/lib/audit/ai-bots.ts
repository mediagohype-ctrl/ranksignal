// AI crawler access analysis from robots.txt (pure). Distinguishes crawlers that fetch pages for live
// AI search/answers from crawlers that collect model-training data — blocking the latter is a
// legitimate business choice and is reported as such, never as an error.
import robotsParser from "robots-parser";

export type AiBotPurpose = "search" | "user" | "training";

export const AI_BOTS: { token: string; owner: string; purpose: AiBotPurpose; label: string }[] = [
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

export interface AiBotRule {
  token: string;
  owner: string;
  purpose: AiBotPurpose;
  label: string;
  /** Homepage allowed for this user agent. */
  allowed: boolean;
  /** robots.txt names this bot explicitly (vs inheriting from `*`). */
  explicit: boolean;
}

export interface RobotsSummary {
  url: string;
  fetched: boolean;
  status: number | null;
  /** All crawlers blocked from the whole site via `User-agent: *` + `Disallow: /`. */
  blocksEveryone: boolean;
  aiBots: AiBotRule[];
}

export function analyzeAiBots(robotsUrl: string, text: string | null, status: number | null): RobotsSummary {
  const fetched = text !== null && status !== null && status >= 200 && status < 300;
  if (!fetched) {
    // No robots.txt (or unreachable) → no restrictions apply.
    return {
      url: robotsUrl,
      fetched: false,
      status,
      blocksEveryone: false,
      aiBots: AI_BOTS.map((b) => ({ ...b, allowed: true, explicit: false })),
    };
  }
  const robot = robotsParser(robotsUrl, text);
  const home = `${new URL(robotsUrl).origin}/`;
  const mentioned = new Set(
    Array.from(text.matchAll(/^\s*user-agent\s*:\s*([^\s#]+)/gim)).map((m) => m[1].toLowerCase()),
  );
  return {
    url: robotsUrl,
    fetched: true,
    status,
    blocksEveryone: robot.isDisallowed(home, "SomeGenericCrawler") === true,
    aiBots: AI_BOTS.map((b) => ({
      ...b,
      allowed: robot.isDisallowed(home, b.token) !== true,
      explicit: mentioned.has(b.token.toLowerCase()),
    })),
  };
}
