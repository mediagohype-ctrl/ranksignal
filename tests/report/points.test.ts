import { describe, expect, it } from "vitest";
import { FINDING_POINTS, issuePoints, pointsForIssue, pointsLabel } from "@/lib/report/points";
import { overallScore, pillarScore } from "@/lib/report/score";
import { issueCounts } from "@/lib/report/issues";
import type { CheckResult, PillarScore, ReportIssue, SiteReport } from "@/lib/report/types";

const check = (id: string, score: number, weight: number, status: CheckResult["status"] = score >= 85 ? "pass" : score >= 50 ? "warn" : "fail"): CheckResult => ({
  id,
  pillar: id.split(".")[0] as CheckResult["pillar"],
  label: id,
  status,
  score,
  weight,
  detail: "",
});

function report(pillars: Record<string, CheckResult[]>, issues: Pick<ReportIssue, "id" | "impact">[] = []): Pick<SiteReport, "overall" | "pillars" | "issues"> {
  const ps: PillarScore[] = Object.entries(pillars).map(([p, checks]) => ({
    pillar: p as PillarScore["pillar"],
    label: p,
    score: pillarScore(checks),
    grade: null,
    summary: "",
    checks,
  }));
  const overall = overallScore(Object.fromEntries(ps.map((p) => [p.pillar, p.score])));
  return { overall: { score: overall, grade: null, headline: "" }, pillars: ps, issues: issues as ReportIssue[] };
}

describe("points (score gain if a problem were fixed)", () => {
  it("is the overall score delta with the check passing", () => {
    // seo: titles 0 (w3) + https 100 (w1) → 25; aeo: 100. overall = (25*.35 + 100*.2)/.55 = 52.27 → 52.
    const r = report({ seo: [check("seo.titles", 0, 3), check("seo.https", 100, 1)], aeo: [check("aeo.readability", 100, 1)] });
    expect(r.overall.score).toBe(52);
    // fixed: seo 100 → overall 100 → +48
    expect(pointsForIssue(r, { id: "seo-titles", impact: "high" })).toBe(48);
  });

  it("maps issue ids with underscores back to check ids", () => {
    const r = report({ seo: [check("seo.meta_description", 40, 2), check("seo.https", 100, 2)] });
    expect(pointsForIssue(r, { id: "seo-meta_description", impact: "medium" })).toBe(30); // 70 → 100
  });

  it("gives at least 1 point when a fix moves the score at all", () => {
    const r = report({ seo: [check("seo.big", 100, 100), check("seo.tiny", 90, 0.1)] });
    expect(pointsForIssue(r, { id: "seo-tiny", impact: "low" })).toBe(1);
  });

  it("estimates finding-based problems from priority", () => {
    const r = report({ seo: [check("seo.https", 50, 1)] });
    expect(pointsForIssue(r, { id: "finding-missing-lang", impact: "high" })).toBe(FINDING_POINTS.high);
    expect(pointsForIssue(r, { id: "seo-unknown_check", impact: "low" })).toBe(FINDING_POINTS.low);
  });

  it("is 0 without a score, and ignores not-measured checks", () => {
    const r = report({ seo: [check("seo.x", 0, 1, "not_measured")] });
    expect(r.overall.score).toBeNull();
    expect(pointsForIssue(r, { id: "seo-x", impact: "high" })).toBe(0);
  });

  it("covers every issue and pluralises the label", () => {
    const r = report({ seo: [check("seo.a", 0, 1), check("seo.b", 100, 1)] }, [
      { id: "seo-a", impact: "high" },
      { id: "finding-x", impact: "low" },
    ]);
    expect(issuePoints(r)).toEqual({ "seo-a": 50, "finding-x": 1 });
    expect(pointsLabel(1)).toBe("+1 point");
    expect(pointsLabel(4)).toBe("+4 points");
  });
});

describe("issueCounts (one count everywhere)", () => {
  it("counts grouped problems, not pages", () => {
    const c = issueCounts([{ impact: "high" }, { impact: "medium" }, { impact: "medium" }, { impact: "low" }]);
    expect(c).toEqual({ critical: 0, high: 1, medium: 2, low: 1, info: 0, total: 4 });
  });
});
