// robots.txt handling: fetch via safeFetch, honour Disallow for our UA (falling back to *),
// cap crawl-delay, and report which AI crawlers are blocked (audit signal, not a judgement).
import robotsParser from "robots-parser";
import { BOT_TOKEN, safeFetch } from "@/lib/crawler/safe-fetch";

export const AI_CRAWLERS = [
  { token: "GPTBot", owner: "OpenAI", purpose: "training" },
  { token: "OAI-SearchBot", owner: "OpenAI", purpose: "search" },
  { token: "PerplexityBot", owner: "Perplexity", purpose: "search" },
  { token: "Google-Extended", owner: "Google", purpose: "training" },
  { token: "ClaudeBot", owner: "Anthropic", purpose: "training" },
] as const;

const MAX_CRAWL_DELAY_MS = 5_000;

export interface RobotsInfo {
  url: string;
  fetched: boolean;
  status: number | null;
  raw: string | null;
  sitemaps: string[];
  crawlDelayMs: number;
  blockedAiCrawlers: string[];
  isAllowed(url: string): boolean;
}

/** Pure parser — used by fetchRobots and tests. */
export function analyzeRobots(robotsUrl: string, text: string | null, status: number | null = 200): RobotsInfo {
  const fetched = text !== null && status !== null && status >= 200 && status < 300;
  if (!fetched) {
    return { url: robotsUrl, fetched: false, status, raw: null, sitemaps: [], crawlDelayMs: 0, blockedAiCrawlers: [], isAllowed: () => true };
  }
  const robot = robotsParser(robotsUrl, text);
  const origin = new URL(robotsUrl).origin;
  const delaySec = robot.getCrawlDelay(BOT_TOKEN);
  const crawlDelayMs = typeof delaySec === "number" && delaySec > 0 ? Math.min(delaySec * 1000, MAX_CRAWL_DELAY_MS) : 0;
  const blockedAiCrawlers = AI_CRAWLERS.filter((c) => robot.isDisallowed(`${origin}/`, c.token) === true).map((c) => c.token);
  return {
    url: robotsUrl,
    fetched: true,
    status,
    raw: text.slice(0, 50_000),
    sitemaps: robot.getSitemaps().slice(0, 20),
    crawlDelayMs,
    blockedAiCrawlers,
    // robots-parser returns undefined for URLs on another origin → treat as allowed (checked per-origin).
    isAllowed: (url: string) => robot.isAllowed(url, BOT_TOKEN) !== false,
  };
}

export async function fetchRobots(origin: string): Promise<RobotsInfo> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  try {
    const res = await safeFetch(robotsUrl, { maxBytes: 512 * 1024, timeoutMs: 10_000 });
    // 4xx → no restrictions; 5xx → treat as unavailable (allow, but reported as not fetched).
    return analyzeRobots(robotsUrl, res.body, res.status);
  } catch {
    return analyzeRobots(robotsUrl, null, null);
  }
}
