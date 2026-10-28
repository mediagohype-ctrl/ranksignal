import { describe, expect, it } from "vitest";
import { gradeFor, METHODOLOGY_VERSION, overallScore, pillarScore } from "@/lib/report/score";

describe("report scoring", () => {
  it("grades by band", () => {
    expect([95, 90, 89, 80, 79, 65, 64, 50, 49, 0].map((s) => gradeFor(s))).toEqual(["A", "A", "B", "B", "C", "C", "D", "D", "F", "F"]);
    expect(gradeFor(null)).toBeNull();
  });

  it("weights checks and excludes not_measured", () => {
    expect(
      pillarScore([
        { status: "pass", score: 100, weight: 3 },
        { status: "fail", score: 0, weight: 1 },
        { status: "not_measured", score: 0, weight: 10 },
      ]),
    ).toBe(75);
    expect(pillarScore([{ status: "not_measured", score: 0, weight: 1 }])).toBeNull();
    expect(pillarScore([])).toBeNull();
  });

  it("renormalises pillar weights over measured pillars", () => {
    expect(overallScore({ seo: 80, aeo: 60, geo: 40, brand: 100 })).toBe(Math.round(80 * 0.35 + 60 * 0.2 + 40 * 0.3 + 100 * 0.15));
    // geo missing → (80*.35 + 60*.2 + 100*.15) / .7
    expect(overallScore({ seo: 80, aeo: 60, geo: null, brand: 100 })).toBe(Math.round((28 + 12 + 15) / 0.7));
    expect(overallScore({})).toBeNull();
    expect(METHODOLOGY_VERSION).toBe("report-1");
  });
});
