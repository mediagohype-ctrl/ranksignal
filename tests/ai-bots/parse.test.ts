import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { matchBot, botUserAgentPattern, isAiBot } from "@/lib/ai-bots-analytics/bots";
import { normalizePath, parseAnyTime, parseClfTime, parseLogLine } from "@/lib/ai-bots-analytics/parse";
import { BotAggregator, mergePaths, OTHER_PATHS } from "@/lib/ai-bots-analytics/aggregate";
import { ipInRanges, parseRangeDocument, type RangeChecker } from "@/lib/ai-bots-analytics/ranges";
import { readLogLines, UploadLimitError, type StreamStats } from "@/lib/ai-bots-analytics/stream";

const GPT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)";
const line = (o: { ip?: string; time?: string; req?: string; status?: number; ua?: string } = {}) =>
  `${o.ip ?? "20.171.207.1"} - - [${o.time ?? "05/Nov/2026:10:00:00 +0000"}] "${o.req ?? "GET /pricing?utm=x HTTP/1.1"}" ${o.status ?? 200} 5120 "-" "${o.ua ?? GPT}"`;

describe("bot matching", () => {
  it("identifies crawlers by user agent, case-insensitively", () => {
    expect(matchBot(GPT)?.token).toBe("GPTBot");
    expect(matchBot("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)")?.token).toBe("ChatGPT-User");
    expect(matchBot("Mozilla/5.0 (compatible; Claude-SearchBot/1.0)")?.token).toBe("Claude-SearchBot");
    expect(matchBot("mozilla/5.0 (compatible; claudebot/1.0)")?.token).toBe("ClaudeBot");
    expect(matchBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")?.token).toBe("Googlebot");
    expect(matchBot("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBeNull();
    expect(matchBot(null)).toBeNull();
  });
  it("never tracks robots.txt-only tokens, and separates AI bots from search engines", () => {
    expect(matchBot("Google-Extended")?.token).not.toBe("Google-Extended");
    expect(isAiBot("GPTBot")).toBe(true);
    expect(isAiBot("Googlebot")).toBe(false);
    expect(new RegExp(botUserAgentPattern(), "i").test(GPT)).toBe(true);
  });
});

describe("log line parsing", () => {
  it("parses combined format, drops the query string and converts to a UTC day", () => {
    const hit = parseLogLine(line({ time: "06/Nov/2026:02:30:00 +0530" }));
    expect(hit).toEqual({ ip: "20.171.207.1", date: "2026-11-05", path: "/pricing", status: 200, userAgent: GPT });
  });
  it("skips lines without a user agent (common format) and garbage", () => {
    expect(parseLogLine(`1.2.3.4 - - [05/Nov/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 12`)).toBeNull();
    expect(parseLogLine("hello world")).toBeNull();
    expect(parseLogLine("")).toBeNull();
  });
  it("handles escaped quotes in the user agent and absolute request targets", () => {
    const hit = parseLogLine(line({ req: "GET https://example.com/a/b?x=1 HTTP/1.1", ua: 'GPTBot \\"x\\"' }));
    expect(hit?.path).toBe("/a/b");
    expect(hit?.userAgent).toBe('GPTBot "x"');
  });
  it("parses Cloudflare Logpush JSON (nanosecond timestamps)", () => {
    const hit = parseLogLine(
      JSON.stringify({ ClientIP: "1.1.1.1", ClientRequestURI: "/blog?id=3", EdgeResponseStatus: 404, ClientRequestUserAgent: "PerplexityBot/1.0", EdgeStartTimestamp: 1_762_336_800_000_000_000 }),
    );
    expect(hit).toMatchObject({ ip: "1.1.1.1", path: "/blog", status: 404, date: "2025-11-05" });
  });
  it("parses generic JSON and Caddy-style nested requests", () => {
    expect(parseLogLine(JSON.stringify({ remote_addr: "2.2.2.2", request_uri: "/x", status: "301", http_user_agent: "bingbot", time_iso8601: "2026-11-01T10:00:00+00:00" })))
      .toMatchObject({ path: "/x", status: 301, date: "2026-11-01" });
    expect(parseLogLine(JSON.stringify({ ts: 1_762_000_000, status: 200, request: { remote_ip: "3.3.3.3", uri: "/c", headers: { "User-Agent": ["ClaudeBot/1.0"] } } })))
      .toMatchObject({ ip: "3.3.3.3", path: "/c", userAgent: "ClaudeBot/1.0" });
  });
  it("time and path helpers", () => {
    expect(parseClfTime("31/Dec/2026:23:30:00 -0100")?.toISOString()).toBe("2027-01-01T00:30:00.000Z");
    expect(parseAnyTime("2026-11-05T00:00:00Z")?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(parseAnyTime(1_762_300_800_000)?.toISOString().slice(0, 10)).toBe("2025-11-05");
    expect(normalizePath("*")).toBeNull();
    expect(normalizePath("/a#frag")).toBe("/a");
    expect(normalizePath(`/${"x".repeat(400)}`)?.length).toBe(300);
  });
});

describe("aggregation", () => {
  const checker: RangeChecker = {
    check: (src, ip) => (!src || !ip ? "claimed" : ip.startsWith("20.") ? "verified" : "unverified"),
    loaded: () => ["openai-gptbot"],
  };
  it("counts only crawler hits per day/bot with statuses, verification and top paths", () => {
    const agg = new BotAggregator(checker);
    for (const l of [
      line(),
      line({ status: 404, req: "GET /old HTTP/1.1" }),
      line({ ip: "6.6.6.6" }),
      line({ ua: "Mozilla/5.0 Chrome/130" }),
      line({ ua: "ClaudeBot/1.0", time: "06/Nov/2026:10:00:00 +0000" }),
    ]) {
      agg.countLine();
      const h = parseLogLine(l);
      if (h) agg.add(h);
    }
    const s = agg.summary();
    expect(s).toMatchObject({ linesTotal: 5, linesParsed: 5, botHits: 4, firstDate: "2026-11-05", lastDate: "2026-11-06" });
    const gpt = agg.buckets.get("2026-11-05|GPTBot")!;
    expect(gpt).toMatchObject({ hits: 3, verifiedHits: 2, unverifiedHits: 1, statusCounts: { "200": 2, "404": 1 } });
    expect(gpt.paths.get("/old")).toEqual({ hits: 1, errors: 1 });
    const claude = agg.buckets.get("2026-11-06|ClaudeBot")!;
    expect(claude.verifiedHits + claude.unverifiedHits).toBe(0); // Anthropic publishes no list → claimed
  });
  it("caps distinct paths per bucket and merges path lists", () => {
    const agg = new BotAggregator(null);
    for (let i = 0; i < 5_010; i++) agg.add({ ip: null, date: "2026-11-05", path: `/p${i}`, status: 200, userAgent: "GPTBot" });
    const b = agg.buckets.get("2026-11-05|GPTBot")!;
    expect(b.paths.size).toBe(5_001);
    expect(b.paths.get(OTHER_PATHS)?.hits).toBe(10);
    expect(mergePaths([{ path: "/a", hits: 2, errors: 0 }], [{ path: "/a", hits: 1, errors: 1 }, { path: "/b", hits: 5, errors: 0 }], 1)).toEqual([{ path: "/b", hits: 5, errors: 0 }]);
  });
});

describe("published IP ranges", () => {
  const cidrs = parseRangeDocument({ creationTime: "x", prefixes: [{ ipv4Prefix: "20.171.206.0/24" }, { ipv6Prefix: "2001:db8::/32" }, { ipv4Prefix: "bad" }, {}] });
  it("parses prefixes and matches IPv4, IPv6 and IPv4-mapped addresses", () => {
    expect(cidrs).toHaveLength(2);
    expect(ipInRanges("20.171.206.9", cidrs)).toBe(true);
    expect(ipInRanges("::ffff:20.171.206.9", cidrs)).toBe(true);
    expect(ipInRanges("2001:db8::1", cidrs)).toBe(true);
    expect(ipInRanges("20.171.207.9", cidrs)).toBe(false);
    expect(ipInRanges("not-an-ip", cidrs)).toBe(false);
    expect(parseRangeDocument(null)).toEqual([]);
  });
});

async function* chunks(buf: Buffer, size = 7): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
}
async function collect(buf: Buffer, opts?: { maxBytes?: number; maxDecompressedBytes?: number }) {
  const stats: StreamStats = { bytes: 0, sha256: "", gzip: false };
  const lines: string[] = [];
  for await (const l of readLogLines(chunks(buf), stats, opts)) lines.push(l);
  return { lines, stats };
}

describe("streaming upload reader", () => {
  const text = `${line()}\r\n${line({ status: 500 })}\nlast-line-without-newline`;
  it("splits lines across chunk boundaries and hashes the raw bytes", async () => {
    const { lines, stats } = await collect(Buffer.from(text));
    expect(lines).toEqual([line(), line({ status: 500 }), "last-line-without-newline"]);
    expect(stats).toMatchObject({ bytes: Buffer.byteLength(text), gzip: false });
    expect(stats.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("gunzips .gz uploads transparently", async () => {
    const { lines, stats } = await collect(gzipSync(Buffer.from(text)));
    expect(stats.gzip).toBe(true);
    expect(lines[0]).toBe(line());
    expect(lines).toHaveLength(3);
  });
  it("rejects uploads over the byte cap and zip bombs over the decompressed cap", async () => {
    await expect(collect(Buffer.alloc(100, 65), { maxBytes: 50 })).rejects.toBeInstanceOf(UploadLimitError);
    await expect(collect(gzipSync(Buffer.alloc(200_000, 10)), { maxDecompressedBytes: 1_000 })).rejects.toMatchObject({ code: "too_large_decompressed" });
  });
  it("reports damaged gzip files", async () => {
    const bad = Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.alloc(50, 1)]);
    await expect(collect(bad)).rejects.toMatchObject({ code: "bad_gzip" });
  });
});
