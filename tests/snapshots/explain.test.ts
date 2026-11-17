// "Why did my score change?" — one line, derived from the two measurements (audit fix 17, fix 10).
import { describe, expect, it } from "vitest";
import { explainScoreChange, freeCheckGapLine, type ScoreFacts } from "@/lib/snapshots/explain";
import { pickPair } from "@/lib/snapshots/explain-server";
import type { SnapshotView } from "@/lib/snapshots/types";

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const facts = (over: Partial<ScoreFacts> = {}): ScoreFacts => ({
  at: new Date("2026-10-20T00:00:00Z"),
  overall: 55,
  pillars: { seo: 60, aeo: 50, geo: 50, brand: 50 },
  pages: 29,
  crawlRunId: "c1",
  aiMeasured: true,
  aiAnswers: 75,
  aiNamed: 0,
  methodologyVersion: "report-1+vi-1",
  checks: null,
  ...over,
});
const check = (id: string, pillar: "seo" | "aeo" | "geo" | "brand", score: number, weight = 2) => ({ id, pillar, label: id, status: "warn", score, weight });

describe("explainScoreChange", () => {
  it("names AI answers joining the score as the reason for a drop", () => {
    const before = facts({ overall: 55, aiMeasured: false, aiAnswers: null, aiNamed: null, pillars: { seo: 60, aeo: 50, geo: 70, brand: 70 } });
    const after = facts({ overall: 49, at: new Date("2026-10-29T00:00:00Z"), pillars: { seo: 60, aeo: 50, geo: 40, brand: 45 } });
    const e = explainScoreChange(before, after, { fmtDate: fmt, now: new Date("2026-11-15T00:00:00Z") })!;
    expect(e.delta).toBe(-6);
    expect(e.reason).toBe("ai_added");
    expect(e.line).toBe("Your score dropped 6 because AI answers were added to your score on 2026-10-29 (AI tools don't mention you yet).");
  });

  it("names Google's speed test when that check moved the score with no other change", () => {
    const before = facts({ overall: 49, checks: [check("seo.core_web_vitals", "seo", 20), check("seo.titles", "seo", 50)] });
    const after = facts({
      overall: 52, at: new Date("2026-11-15T00:00:00Z"), pillars: { seo: 69, aeo: 50, geo: 50, brand: 50 },
      checks: [check("seo.core_web_vitals", "seo", 70), check("seo.titles", "seo", 50)],
    });
    const e = explainScoreChange(before, after, { fmtDate: fmt, now: new Date("2026-11-15T10:00:00Z") })!;
    expect(e.reason).toBe("speed");
    expect(e.line).toBe("Your score went up 3 because Google's speed test gave better results today.");
  });

  it("names a different number of pages read", () => {
    const before = facts({ overall: 61, pages: 5, crawlRunId: "c0", pillars: { seo: 80, aeo: 60, geo: 50, brand: 50 } });
    const after = facts({ overall: 52, pages: 29, crawlRunId: "c1", pillars: { seo: 60, aeo: 45, geo: 50, brand: 50 } });
    expect(explainScoreChange(before, after, { fmtDate: fmt })!.line).toBe("Your score dropped 9 because we read more pages (29 instead of 5).");
  });

  it("names a change of scoring method", () => {
    const e = explainScoreChange(facts({ overall: 50 }), facts({ overall: 53, methodologyVersion: "report-2+vi-1", at: new Date("2026-11-01T00:00:00Z") }), { fmtDate: fmt })!;
    expect(e.reason).toBe("method");
  });

  it("falls back to the parts that moved", () => {
    const e = explainScoreChange(
      facts({ overall: 50, pillars: { seo: 50, aeo: 50, geo: 50, brand: 50 } }),
      facts({ overall: 52, pillars: { seo: 57, aeo: 50, geo: 46, brand: 50 } }),
      { fmtDate: fmt },
    )!;
    expect(e.line).toBe("Your score went up 2 because of these parts: SEO +7, GEO −4.");
  });

  it("says nothing when the score didn't move or is missing", () => {
    expect(explainScoreChange(facts(), facts(), { fmtDate: fmt })).toBeNull();
    expect(explainScoreChange(null, facts())).toBeNull();
  });
});

describe("pickPair", () => {
  const snap = (id: string, crawlRunId: string, overallScore: number | null, day: number): SnapshotView => ({
    id, projectId: "p", kind: "crawl", crawlRunId, visibilityRunId: null, createdAt: new Date(Date.UTC(2026, 10, day)), overallScore, grade: null,
    pillarScores: { seo: null, aeo: null, geo: null, brand: null }, openIssues: null, visibility: null, promptSetVersion: null,
    methodologyVersion: "m", simulated: false,
  });
  const rows = [snap("s1", "c1", 61, 1), snap("s2", "c1", 55, 2), snap("s3", "c2", 52, 9)];
  it("start = first vs latest; recheck = last of the previous check vs latest", () => {
    expect(pickPair(rows, "start")!.before.id).toBe("s1");
    expect(pickPair(rows, "recheck")!.before.id).toBe("s2");
    expect(pickPair(rows.slice(0, 1), "start")).toBeNull();
  });
});

describe("freeCheckGapLine", () => {
  it("uses real numbers when the free-check score is known", () => {
    expect(freeCheckGapLine({ freeScore: 61, freePages: 5, fullScore: 49, fullPages: 29, aiMeasured: true })).toBe(
      "Your free check read up to 5 pages (61). We've now read 29 pages and asked AI about you, so your full score is 49.",
    );
  });
  it("is generic (no invented numbers) when the free-check score is unknown", () => {
    const l = freeCheckGapLine({ freeScore: null, freePages: 5, fullScore: 49, fullPages: 29, aiMeasured: false })!;
    expect(l).not.toMatch(/\(\d+\)/);
    expect(l).toMatch(/A free check reads only a few pages/);
  });
  it("says nothing when both scores are the same", () => {
    expect(freeCheckGapLine({ freeScore: 49, freePages: 5, fullScore: 49, fullPages: 29, aiMeasured: true })).toBeNull();
  });
});
