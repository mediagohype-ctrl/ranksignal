import { describe, expect, it } from "vitest";
import { composeReport } from "@/lib/report/compose";
import { buildIssues, ISSUE_COPY_IDS, sortIssues } from "@/lib/report/issues";
import { makeCheck } from "@/lib/report/inputs";
import { reportToMarkdown } from "@/lib/report/markdown";
import { FORBIDDEN_CLAIMS } from "@/lib/report/summary";
import { summarizeVisibility } from "@/lib/report/visibility";
import type { ReportIssue } from "@/lib/report/types";
import { ARTICLE, BAD_PAGE, GOOD_HOME, ctx, page } from "./fixtures";

const pages = [page("/", GOOD_HOME), page("/services", BAD_PAGE("/services")), page("/team", BAD_PAGE("/team")), page("/blog/why-pipes-burst", ARTICLE)];
const base = { projectId: "p1", brand: "Acme Plumbing", websiteUrl: "https://acme.example/", generatedAt: new Date("2026-10-28T00:00:00Z") };

describe("composeReport", () => {
  it("handles no crawl yet", () => {
    const r = composeReport({ ...base, crawl: null, ctx: ctx([]) });
    expect(r.overall.score).toBeNull();
    expect(r.overall.grade).toBeNull();
    expect(r.issues).toEqual([]);
    expect(r.overall.headline).toMatch(/run a scan/i);
    expect(r.pillars.map((p) => p.pillar)).toEqual(["seo", "aeo", "geo", "brand"]);
    expect(r.pillars.every((p) => p.score === null)).toBe(true);
    expect(r.executiveSummarySource).toBe("template");
    expect(r.executiveSummary.length).toBeGreaterThan(20);
  });

  it("builds a full report from crawl data", () => {
    const r = composeReport({ ...base, crawl: { crawlRunId: "c1", pagesCrawled: 4, pagesFound: 10, finishedAt: new Date() }, ctx: ctx(pages) });
    expect(r.overall.score).not.toBeNull();
    expect(r.pillars.find((p) => p.pillar === "geo")!.score).not.toBeNull();
    expect(r.issues.length).toBeGreaterThan(3);
    // sorted impact desc then effort asc
    const rank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < r.issues.length; i++) expect(rank[r.issues[i - 1].impact]).toBeLessThanOrEqual(rank[r.issues[i].impact]);
    expect(r.quickWins.length).toBeLessThanOrEqual(5);
    for (const id of r.quickWins) {
      const i = r.issues.find((x) => x.id === id)!;
      expect(i.effort).toBe("quick");
      expect(["high", "medium"]).toContain(i.impact);
    }
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.limitations.join(" ")).toMatch(/4 of at least 10 pages/);
    expect(r.limitations.join(" ")).toMatch(/hasn't been measured/);
    // contract: pillar checks don't leak internal fields
    expect(Object.keys(r.pillars[0].checks[0]).sort()).toEqual(["detail", "id", "label", "pillar", "score", "status", "weight"]);
    expect(FORBIDDEN_CLAIMS.test(r.executiveSummary)).toBe(false);
    const md = reportToMarkdown(r);
    expect(md).toContain("# Website report for Acme Plumbing");
    expect(md).toContain("## What to fix");
  });
});

describe("issue copy", () => {
  it("never uses guarantee wording, for every check in fail and warn state", () => {
    const all: ReportIssue[] = [];
    for (const id of ISSUE_COPY_IDS) {
      for (const status of ["fail", "warn"] as const) {
        const c = makeCheck(id.split(".")[0] as "seo", id, id, 1, {
          score: status === "fail" ? 10 : 60, status, detail: "3 of 10 pages affected.", affected: ["https://acme.example/a"],
          facts: { missing: 3, duplicate: 2, long: 1, short: 1, total: 10, errors: 1, noindex: 1, chains: 1, broken: 2, orphans: 1, images: 5, thin: 2, duplicates: 2, withQuestions: 1, questions: 4, answered: 1, without: 2, avg: 35, hard: 2, valid: 3, invalid: 1, shallow: 2, withStats: 1, citing: 0, dated: 1, recent: 0, withAuthor: 0, sameAs: 0, hasOrg: false, inaccuracies: 1, platforms: 0, homeHttps: false, topCompetitor: "PipeCo" },
        });
        all.push(...buildIssues([c]));
      }
    }
    expect(all.length).toBe(ISSUE_COPY_IDS.length * 2);
    for (const i of all) {
      const text = [i.title, i.whatsWrong, i.whyItMatters, ...i.howToFix].join(" ");
      expect(text, i.id).not.toMatch(/guarant/i);
      expect(FORBIDDEN_CLAIMS.test(text), i.id).toBe(false);
      expect(i.howToFix.length, i.id).toBeGreaterThan(0);
      expect(i.whatsWrong.trim().length, i.id).toBeGreaterThan(10);
    }
  });

  it("dedupes, adds uncovered findings, and sorts", () => {
    const c = makeCheck("seo", "seo.sitemap", "Sitemap", 1, { score: 20, detail: "none" });
    const issues = buildIssues([c, c], [
      { code: "missing_lang", severity: "low", category: "technical", pageUrl: "https://acme.example/a", message: "no lang" },
      { code: "missing_lang", severity: "low", category: "technical", pageUrl: "https://acme.example/b", message: "no lang" },
      { code: "missing_title", severity: "high", category: "metadata", pageUrl: "https://acme.example/a", message: "covered" },
    ]);
    expect(issues.map((i) => i.id)).toEqual(["seo-sitemap", "finding-missing-lang"]);
    expect(issues[1].affectedCount).toBe(2);
    const s = sortIssues([
      { ...issues[0], id: "a", impact: "low", effort: "quick" },
      { ...issues[0], id: "b", impact: "high", effort: "involved" },
      { ...issues[0], id: "c", impact: "high", effort: "quick" },
    ]);
    expect(s.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
});

describe("summarizeVisibility", () => {
  const obs = (o: Partial<Parameters<typeof summarizeVisibility>[1][number]>) => ({
    provider: "openai", platformLabel: "ChatGPT", promptText: "best plumber in pune", brandMentioned: false, brandCited: false,
    brandRecommended: false, competitorMentions: {}, citations: [], simulated: false, createdAt: new Date(), ...o,
  });
  it("prefers real observations and lists prompts where the brand is missing", () => {
    const { summary, excludedSimulated } = summarizeVisibility({ metrics: null, finishedAt: new Date("2026-10-01") }, [
      obs({ brandMentioned: true, competitorMentions: { "Acme Plumbing": 1 } }),
      obs({ promptText: "cheap boiler service", competitorMentions: { PipeCo: 2 } }),
      obs({ simulated: true, brandMentioned: true }),
    ], ["Acme Plumbing"]);
    expect(excludedSimulated).toBe(1);
    expect(summary.simulated).toBe(false);
    expect(summary.sampleSize).toBe(2);
    expect(summary.mentionRate).toBe(0.5);
    expect(summary.promptsWhereMissing).toEqual([{ prompt: "cheap boiler service", competitorsMentioned: ["PipeCo"] }]);
    expect(summary.topCompetitors[0].name).toBe("PipeCo");
  });
  it("reads brandKnowledge from run metrics", () => {
    const { summary } = summarizeVisibility({ metrics: { brandKnowledge: [{ provider: "openai", knowsBrand: true, summary: "A plumber", inaccuracies: ["wrong city"] }] }, finishedAt: null }, [], ["Acme"]);
    expect(summary.brandKnowledge?.[0].inaccuracies).toEqual(["wrong city"]);
    expect(summary.measured).toBe(false);
  });
});
