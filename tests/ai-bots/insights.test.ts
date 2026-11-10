import { describe, expect, it } from "vitest";
import { buildDashboard, buildTakeaways, chartSeries, OTHER_AI_SERIES } from "@/lib/ai-bots-analytics/insights";
import { cloudflareWorkerSnippet, createRateLimiter, generateIngestToken, parseIngestBatch, readIngestToken, tokenMatches } from "@/lib/ai-bots-analytics/ingest";
import type { DailyRow } from "@/lib/ai-bots-analytics/store";

const row = (o: Partial<DailyRow> & { date: string; bot: string }): DailyRow => ({
  hits: 0, verifiedHits: 0, unverifiedHits: 0, statusCounts: {}, topPaths: [], ...o,
});

describe("takeaways", () => {
  const rows = [
    row({ date: "2026-11-01", bot: "GPTBot", hits: 100, statusCounts: { "200": 86, "404": 14 }, topPaths: [{ path: "/old", hits: 14, errors: 14 }, { path: "/", hits: 86, errors: 0 }] }),
    row({ date: "2026-11-03", bot: "GPTBot", hits: 20, statusCounts: { "200": 20 } }),
    row({ date: "2026-11-03", bot: "ClaudeBot", hits: 30, statusCounts: { "403": 30 } }),
    row({ date: "2026-11-02", bot: "Googlebot", hits: 400, statusCounts: { "200": 400 } }),
    row({ date: "2026-10-01", bot: "PerplexityBot", hits: 5, statusCounts: { "200": 5 } }),
  ];
  it("summarises the week ending on the newest day in plain English", () => {
    const t = buildTakeaways(rows);
    expect(t[0]).toBe("GPTBot (OpenAI model training) read 120 pages in the week ending 2026-11-03; 14 requests got errors.");
    expect(t).toContain("ClaudeBot (Anthropic model training) read 30 pages in the week ending 2026-11-03; 30 requests got errors.");
    expect(t.some((s) => s.startsWith("ClaudeBot was turned away 30 times"))).toBe(true);
    expect(t.some((s) => s.includes("/old (14 errors)"))).toBe(true);
    expect(t.some((s) => s.startsWith("For comparison, Googlebot read 400 pages"))).toBe(true);
    expect(t.join(" ")).not.toContain("PerplexityBot"); // outside the week
  });
  it("flags visits from outside the operator's published IPs", () => {
    const t = buildTakeaways([row({ date: "2026-11-01", bot: "GPTBot", hits: 10, unverifiedHits: 5, statusCounts: { "200": 10 } })]);
    expect(t.some((s) => s.startsWith("5 visits claiming to be GPTBot came from IP addresses outside OpenAI's published list"))).toBe(true);
  });
  it("explains when no AI crawler shows up", () => {
    expect(buildTakeaways([row({ date: "2026-11-01", bot: "Googlebot", hits: 3 })])[0]).toMatch(/^No AI crawlers/);
    expect(buildTakeaways([])).toEqual([]);
  });
  it("builds a gap-free daily series and groups small crawlers in the chart", () => {
    const d = buildDashboard(rows);
    expect(d.days[0]).toBe("2026-10-01");
    expect(d.days.at(-1)).toBe("2026-11-03");
    expect(d.series.find((p) => p.date === "2026-10-15")?.GPTBot).toBe(0);
    expect(d.totals).toEqual({ aiHits: 155, searchHits: 400, aiErrors: 44, aiBlocked: 30 });
    const c = chartSeries(d, 1);
    expect(c.bots).toEqual(["GPTBot", OTHER_AI_SERIES]);
    expect(c.data.find((p) => p.date === "2026-11-03")).toEqual({ date: "2026-11-03", GPTBot: 20, [OTHER_AI_SERIES]: 30 });
    expect(c.bots).not.toContain("Googlebot");
  });
});

describe("ingest helpers", () => {
  it("generates tokens that are only stored as hashes and compared in constant time", () => {
    const t = generateIngestToken();
    expect(t.token).toMatch(/^mwr_bot_/);
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.hash).not.toContain(t.token);
    expect(tokenMatches(t.token, t.hash)).toBe(true);
    expect(tokenMatches(generateIngestToken().token, t.hash)).toBe(false);
    expect(readIngestToken(new Headers({ authorization: `Bearer ${t.token}` }))).toBe(t.token);
    expect(readIngestToken(new Headers({ authorization: "Bearer nope" }))).toBeNull();
    expect(readIngestToken(new Headers())).toBeNull();
  });
  it("accepts events or raw lines, rejects bad shapes and oversized batches", () => {
    const b = parseIngestBatch({ events: [{ ip: "1.1.1.1", path: "/a?q=1", status: 200, userAgent: "GPTBot", time: "2026-11-01T00:00:00Z" }, { nope: 1 }] });
    expect(b?.received).toBe(2);
    expect(b?.hits).toEqual([{ ip: "1.1.1.1", date: "2026-11-01", path: "/a", status: 200, userAgent: "GPTBot" }]);
    expect(parseIngestBatch({ lines: ['1.1.1.1 - - [01/Nov/2026:00:00:00 +0000] "GET / HTTP/1.1" 200 1 "-" "ClaudeBot"'] })?.hits).toHaveLength(1);
    expect(parseIngestBatch({ events: new Array(1001).fill({}) })).toBeNull();
    expect(parseIngestBatch("x")).toBeNull();
  });
  it("rate-limits per key in a sliding window", () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.take("p", 0).ok).toBe(true);
    expect(rl.take("p", 10).ok).toBe(true);
    expect(rl.take("p", 20)).toEqual({ ok: false, retryAfterSec: 1 });
    expect(rl.take("q", 20).ok).toBe(true);
    expect(rl.take("p", 1001).ok).toBe(true);
  });
  it("Worker snippet points at the endpoint and never sends query strings or the token in code", () => {
    const s = cloudflareWorkerSnippet("https://app.example/api/projects/p1/ai-bots/ingest");
    expect(s).toContain('const INGEST_URL = "https://app.example/api/projects/p1/ai-bots/ingest"');
    expect(s).toContain("env.MYWEBRANK_TOKEN");
    expect(s).toContain("url.pathname");
    expect(s).not.toMatch(/url\.search\b/);
    expect(s).toContain("ctx.waitUntil");
  });
});
