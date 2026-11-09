import { describe, expect, it, vi } from "vitest";
import { aiRobotsSnippets, buildAiCrawlerReport, pageAiSignals } from "@/lib/tools/ai-crawlers";
import { analyzeAiBots } from "@/lib/audit/ai-bots";

// Route tests: no DNS or network. assertPublicUrl (used by validateFreeCheckUrl) and safeFetch are faked.
const pages: Record<string, { status: number; body: string; headers?: Record<string, string> }> = {
  "https://shop.test/robots.txt": { status: 200, body: "User-agent: GPTBot\nDisallow: /\n" },
  "https://shop.test/": { status: 200, body: '<html><head><meta name="robots" content="max-snippet:0"></head></html>', headers: { "x-robots-tag": "noai" } },
};
vi.mock("@/lib/crawler/safe-fetch", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crawler/safe-fetch")>();
  return {
    ...real,
    assertPublicUrl: async (u: string) => ({ url: new URL(u), address: "93.184.216.34", family: 4 }),
    safeFetch: async (u: string) => {
      const p = pages[u];
      if (!p) throw new real.SafeFetchError("network", "nope");
      return { finalUrl: u, status: p.status, headers: new Headers(p.headers ?? {}), body: p.body, redirectChain: [] };
    },
  };
});

describe("POST /api/public/tools/ai-crawler-checker and robots-txt-tester", () => {
  const post = (url: string) =>
    new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ url }) });

  it("returns the report with no-store", async () => {
    const { POST } = await import("@/app/api/public/tools/ai-crawler-checker/route");
    const res = await POST(post("shop.test"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { result } = (await res.json()) as { result: { training: { token: string; allowed: boolean }[]; signals: { directive: string }[] } };
    expect(result.training.find((b) => b.token === "GPTBot")!.allowed).toBe(false);
    expect(result.signals.map((s) => s.directive).sort()).toEqual(["max-snippet:0", "noai"]);
  });

  it("rejects bad input and returns robots.txt text", async () => {
    const { POST } = await import("@/app/api/public/tools/robots-txt-tester/route");
    expect((await POST(post("not a url"))).status).toBe(400);
    const res = await POST(post("https://shop.test/some/page"));
    const { result } = (await res.json()) as { result: { robotsUrl: string; status: number; text: string } };
    expect(result).toMatchObject({ robotsUrl: "https://shop.test/robots.txt", status: 200, text: "User-agent: GPTBot\nDisallow: /\n" });
  });
});

const base = { robotsUrl: "https://e.test/robots.txt", html: "<html><head></head></html>", pageStatus: 200, xRobotsTag: null };

describe("buildAiCrawlerReport", () => {
  it("groups crawlers into answers vs training", () => {
    const r = buildAiCrawlerReport({ ...base, robotsText: "", robotsStatus: 404 });
    expect(r.answers.map((b) => b.token)).toEqual(expect.arrayContaining(["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot"]));
    expect(r.training.map((b) => b.token)).toEqual(expect.arrayContaining(["GPTBot", "Google-Extended", "CCBot", "ClaudeBot"]));
    expect(r.robotsFound).toBe(false);
    expect(r.summary.tone).toBe("success");
    expect(r.training.find((b) => b.token === "Google-Extended")!.note).toMatch(/Not a separate crawler/);
  });

  it("calls blocking training a fair choice but warns about blocked search bots", () => {
    const training = buildAiCrawlerReport({ ...base, robotsText: "User-agent: GPTBot\nDisallow: /\n", robotsStatus: 200 });
    expect(training.summary).toMatchObject({ tone: "success" });
    expect(training.summary.body).toMatch(/fair business choice/);
    const search = buildAiCrawlerReport({ ...base, robotsText: "User-agent: OAI-SearchBot\nDisallow: /\n", robotsStatus: 200 });
    expect(search.summary.tone).toBe("warning");
    expect(search.summary.body).toMatch(/OAI-SearchBot/);
  });

  it("flags a whole-site block, a noindex homepage and a robots.txt server error", () => {
    expect(buildAiCrawlerReport({ ...base, robotsText: "User-agent: *\nDisallow: /\n", robotsStatus: 200 }).summary.tone).toBe("danger");
    const noindex = buildAiCrawlerReport({ ...base, html: '<meta name="robots" content="noindex">', robotsText: "", robotsStatus: 404 });
    expect(noindex.summary.title).toMatch(/hidden/);
    expect(buildAiCrawlerReport({ ...base, robotsText: null, robotsStatus: 503 }).summary.title).toMatch(/server error/);
  });
});

describe("pageAiSignals", () => {
  it("reads robots meta tags, bot-specific tags and X-Robots-Tag", () => {
    const html = '<meta name="robots" content="noai, noimageai"><meta name="googlebot" content="nosnippet"><meta name="GPTBot" content="noindex"><meta name="description" content="noindex">';
    const s = pageAiSignals(html, "googlebot: noindex, nofollow, otherbot: max-snippet: 0");
    const keys = s.map((x) => `${x.source}|${x.appliesTo}|${x.directive}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        '<meta name="robots">|all|noai',
        '<meta name="robots">|all|noimageai',
        '<meta name="googlebot">|googlebot|nosnippet',
        '<meta name="gptbot">|gptbot|noindex',
        "X-Robots-Tag header|googlebot|noindex",
        "X-Robots-Tag header|otherbot|max-snippet:0",
      ]),
    );
    expect(keys.some((k) => k.includes("description"))).toBe(false);
    expect(pageAiSignals("", "noindex")[0]).toMatchObject({ appliesTo: "all", tone: "danger" });
  });
});

describe("aiRobotsSnippets", () => {
  it("'allow search, block training' really does that when parsed", () => {
    const { allowSearchBlockTraining, allowAll } = aiRobotsSnippets();
    const r = analyzeAiBots("https://e.test/robots.txt", `User-agent: *\nAllow: /\n\n${allowSearchBlockTraining}`, 200);
    for (const b of r.aiBots) expect(b.allowed, b.token).toBe(b.purpose !== "training");
    const all = analyzeAiBots("https://e.test/robots.txt", `User-agent: *\nDisallow: /\n\n${allowAll}`, 200);
    expect(all.aiBots.every((b) => b.allowed)).toBe(true);
  });
});
