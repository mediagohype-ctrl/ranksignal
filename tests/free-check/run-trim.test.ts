import { describe, expect, it } from "vitest";
import type { SafeFetchOptions, SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { SafeFetchError } from "@/lib/crawler/safe-fetch";
import type { SiteReport } from "@/lib/report/types";
import { FREE_MAX_FIX_STEPS, FREE_MAX_ISSUES, trimReport } from "@/lib/free-check/trim";
import { FreeCheckError, pickKeyPages, runFreeCheck } from "@/lib/free-check/run";
import { AI_VISIBILITY_NOTE } from "@/lib/free-check/types";
import { extractPage } from "@/lib/crawler/extract";
import { BAD_PAGE, GOOD_HOME, ORIGIN } from "../report/fixtures";

function fakeReport(): SiteReport {
  const issue = (n: number) => ({
    id: `i${n}`,
    pillar: "seo" as const,
    title: `Issue ${n}`,
    whatsWrong: "wrong",
    whyItMatters: "matters",
    howToFix: ["one", "two", "three", "four"],
    impact: "high" as const,
    effort: "quick" as const,
    affectedUrls: ["https://x.example/a"],
    affectedCount: 3,
  });
  return {
    projectId: "free-check",
    brand: "X",
    websiteUrl: "https://x.example/",
    generatedAt: "2026-10-28T00:00:00.000Z",
    crawl: { crawlRunId: "free-check", pagesCrawled: 2, finishedAt: null },
    overall: { score: 61, grade: "D", headline: "Your website scores 61/100 (D)." },
    pillars: [
      {
        pillar: "seo",
        label: "SEO",
        score: 70,
        grade: "C",
        summary: "ok",
        checks: [
          { id: "a", pillar: "seo", label: "A", status: "pass", score: 100, weight: 1, detail: "" },
          { id: "b", pillar: "seo", label: "B", status: "not_measured", score: 0, weight: 3, detail: "" },
          { id: "c", pillar: "seo", label: "C", status: "fail", score: 0, weight: 1, detail: "" },
        ],
      },
      { pillar: "aeo", label: "AEO", score: 50, grade: "D", summary: "x", checks: [] },
      { pillar: "geo", label: "GEO", score: null, grade: null, summary: "Not measured yet", checks: [] },
      { pillar: "brand", label: "Brand", score: 40, grade: "F", summary: "x", checks: [] },
    ],
    issues: Array.from({ length: 9 }, (_, i) => issue(i)),
    quickWins: [],
    strengths: ["s1", "s2", "s3", "s4", "s5", "s6", "s7"],
    aiVisibility: {} as SiteReport["aiVisibility"],
    executiveSummary: "",
    executiveSummarySource: "template",
    limitations: [],
    methodologyVersion: "report-1",
  };
}

describe("trimReport", () => {
  it("keeps only the top issues, first fix steps, measured checks and the AI-visibility note", () => {
    const r = trimReport(fakeReport(), { brand: "X", pagesChecked: ["https://x.example/"] });
    expect(r.issues).toHaveLength(FREE_MAX_ISSUES);
    expect(r.totalIssues).toBe(9);
    expect(r.issues[0].howToFix).toEqual(["one", "two"].slice(0, FREE_MAX_FIX_STEPS));
    expect(r.issues[0]).not.toHaveProperty("affectedUrls");
    expect(r.issues[0]).not.toHaveProperty("whyItMatters");
    expect(r.issues[0].pillarLabel).toBe("SEO");
    expect(r.strengths).toHaveLength(5);
    expect(r.pillars.map((p) => p.pillar)).toEqual(["seo", "aeo", "geo", "brand"]);
    expect(r.pillars[0].checks.map((c) => c.id)).toEqual(["c", "a"]); // not_measured dropped, fails first
    expect(r.pillars[2].summary).toMatch(/full report/i);
    expect(r.notes).toContain(AI_VISIBILITY_NOTE);
    expect(r).not.toHaveProperty("aiVisibility");
    expect(r).not.toHaveProperty("projectId");
  });
});

describe("pickKeyPages", () => {
  it("prefers nav/key pages, skips legal + off-site + robots-disallowed, max 4", () => {
    const home = extractPage(GOOD_HOME, `${ORIGIN}/`, ["acme.example"]);
    const picked = pickKeyPages(home, `${ORIGIN}/`, ["acme.example"], (u) => !u.endsWith("/services"));
    expect(picked).toContain(`${ORIGIN}/about`);
    expect(picked).toContain(`${ORIGIN}/contact`);
    expect(picked).not.toContain(`${ORIGIN}/services`);
    expect(picked.some((u) => u.includes("privacy"))).toBe(false);
    expect(picked.every((u) => u.startsWith(ORIGIN))).toBe(true);
    expect(picked.length).toBeLessThanOrEqual(4);
  });
});

describe("runFreeCheck (injected fetcher, no network/DB)", () => {
  const ok = (url: string, body: string, type = "text/html"): SafeFetchResult => ({
    finalUrl: url,
    status: 200,
    headers: new Headers({ "content-type": type }),
    body,
    redirectChain: [],
  });

  it("scores homepage + key pages and returns a trimmed result", async () => {
    const calls: { url: string; opts: SafeFetchOptions }[] = [];
    const fetcher = async (url: string, opts: SafeFetchOptions) => {
      calls.push({ url, opts });
      if (url === `${ORIGIN}/`) return ok(url, GOOD_HOME);
      if (url === `${ORIGIN}/robots.txt`) return ok(url, "User-agent: *\nAllow: /\nSitemap: https://acme.example/sitemap.xml\n", "text/plain");
      if (url === `${ORIGIN}/sitemap.xml`) return ok(url, `<urlset><url><loc>${ORIGIN}/</loc></url></urlset>`, "application/xml");
      if (url === `${ORIGIN}/llms.txt`) return { ...ok(url, "nf"), status: 404 };
      if (url === "http://acme.example/") return { ...ok(`${ORIGIN}/`, GOOD_HOME), redirectChain: [url] };
      if (url.startsWith(ORIGIN)) return ok(url, BAD_PAGE(new URL(url).pathname));
      throw new SafeFetchError("blocked", "off-site");
    };
    const r = await runFreeCheck(`${ORIGIN}/`, { fetcher });
    expect(r.url).toBe(`${ORIGIN}/`);
    expect(r.brand).toBe("Acme Plumbing");
    expect(r.pagesChecked.length).toBeGreaterThan(1);
    expect(r.pagesChecked.length).toBeLessThanOrEqual(5);
    expect(r.overall.score).not.toBeNull();
    expect(r.issues.length).toBeLessThanOrEqual(5);
    expect(r.issues.every((i) => i.howToFix.length <= 2)).toBe(true);
    expect(r.notes[0]).toBe(AI_VISIBILITY_NOTE);
    // AI-answer checks are never shown as measured in the free check.
    const AI_ANSWER_CHECKS = ["geo.ai_mention_rate", "geo.ai_citation_rate", "geo.competitor_share", "brand.ai_recommendation", "brand.ai_knowledge"];
    expect(r.pillars.flatMap((p) => p.checks).some((c) => AI_ANSWER_CHECKS.includes(c.id))).toBe(false);
    // Every fetch had a timeout within the budget.
    expect(calls.every((c) => (c.opts.timeoutMs ?? 0) > 0 && (c.opts.timeoutMs ?? 0) <= 10_000)).toBe(true);
    expect(calls.length).toBeLessThanOrEqual(1 + 3 + 1 + 4);
  });

  it("maps homepage failures to friendly errors", async () => {
    await expect(runFreeCheck(`${ORIGIN}/`, { fetcher: async () => { throw new SafeFetchError("timeout", "t"); } })).rejects.toMatchObject({ code: "timeout" });
    await expect(runFreeCheck(`${ORIGIN}/`, { fetcher: async () => { throw new SafeFetchError("blocked", "b"); } })).rejects.toBeInstanceOf(FreeCheckError);
    await expect(runFreeCheck(`${ORIGIN}/`, { fetcher: async (u) => ({ ...ok(u, "x"), status: 500 }) })).rejects.toMatchObject({ code: "unreachable" });
    await expect(runFreeCheck(`${ORIGIN}/`, { fetcher: async (u) => ok(u, "%PDF", "application/pdf") })).rejects.toMatchObject({ code: "not_html" });
  });
});
