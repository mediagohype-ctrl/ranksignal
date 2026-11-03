import { describe, expect, it } from "vitest";
import { composeReport } from "@/lib/report/compose";
import { PILLAR_LABELS, scoreLabel } from "@/lib/report/score";
import { scoreBand } from "@/components/ui/score";
import { ARTICLE, BAD_PAGE, GOOD_HOME, ctx, page } from "./fixtures";

const pages = [page("/", GOOD_HOME), page("/services", BAD_PAGE("/services")), page("/blog/why-pipes-burst", ARTICLE)];
const base = { projectId: "p1", brand: "Acme Plumbing", websiteUrl: "https://acme.example/", generatedAt: new Date("2026-10-28T00:00:00Z") };
const crawl = { crawlRunId: "c1", pagesCrawled: 3, pagesFound: 3, finishedAt: new Date() };

describe("one score, one colour rule", () => {
  it("uses the same bands everywhere: Good ≥ 75, Needs work 50–74, Poor < 50", () => {
    expect([scoreBand(75), scoreBand(74), scoreBand(50), scoreBand(49), scoreBand(null)]).toEqual(["good", "ok", "ok", "poor", "none"]);
    expect([scoreLabel(75), scoreLabel(74), scoreLabel(49), scoreLabel(null)]).toEqual(["Good", "Needs work", "Poor", "Not checked yet"]);
  });

  it("names the parts in plain words", () => {
    expect(Object.values(PILLAR_LABELS).join(" ")).not.toMatch(/\b(SEO|AEO|GEO)\b/);
  });
});

describe("partial score until AI answers arrive", () => {
  it("marks the score and the AI parts partial when no AI answers were collected", () => {
    const r = composeReport({ ...base, crawl, ctx: ctx(pages) });
    expect(r.overall.score).not.toBeNull();
    expect(r.overall.partial).toBe(true);
    expect(r.pillars.find((p) => p.pillar === "geo")!.partial).toBe(true);
    expect(r.pillars.find((p) => p.pillar === "seo")!.partial).toBeUndefined();
    expect(r.pillars.find((p) => p.pillar === "geo")!.summary).toMatch(/Waiting for AI results/);
    expect(r.overall.headline).toMatch(/^\d+ \/ 100 · (Good|Needs work|Poor)\./);
  });

  it("is not partial once real AI answers are in", () => {
    const c = ctx(pages);
    c.ai = { ...c.ai, measured: true, simulated: false, sampleSize: 20, collected: 20, mentionRate: 0.25, citationRate: 0.1, recommendationRate: 0.05, visibilityIndex: 20 };
    const r = composeReport({ ...base, crawl, ctx: c });
    expect(r.overall.partial).toBeUndefined();
    expect(r.pillars.some((p) => p.partial)).toBe(false);
  });

  it("treats simulated (demo) answers as not in yet", () => {
    const c = ctx(pages);
    c.ai = { ...c.ai, measured: true, simulated: true, sampleSize: 20, collected: 20 };
    expect(composeReport({ ...base, crawl, ctx: c }).overall.partial).toBe(true);
  });
});
