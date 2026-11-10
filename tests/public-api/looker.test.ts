// Looker Studio rows: one per day, scores carried forward from the latest check, GSC only for days with data.
import { describe, expect, it } from "vitest";
import { buildLookerRows, datesBetween, LOOKER_FIELDS } from "@/lib/public-api/looker";
import type { SnapshotView } from "@/lib/snapshots/types";

function snap(at: string, o: Partial<SnapshotView> = {}): SnapshotView {
  return {
    id: at,
    projectId: "p1",
    kind: "crawl",
    crawlRunId: null,
    visibilityRunId: null,
    createdAt: new Date(at),
    overallScore: null,
    grade: null,
    pillarScores: { seo: null, aeo: null, geo: null, brand: null },
    openIssues: null,
    visibility: null,
    promptSetVersion: null,
    methodologyVersion: "m",
    simulated: false,
    ...o,
  };
}

const vis = (mentionRate: number, collected = 30) => ({
  mentionRate,
  citationRate: 0.1,
  recommendationRate: 0.05,
  visibilityIndex: 20,
  competitorShare: {},
  sampleSize: collected,
  collected,
  providers: ["openai"],
  formulaVersion: "vi-1",
});

describe("buildLookerRows", () => {
  it("lists every day inclusive", () => {
    expect(datesBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  it("is empty-valued before the first check and carries values forward after", () => {
    const rows = buildLookerRows(
      [
        snap("2026-10-02T09:00:00Z", { overallScore: 60, pillarScores: { seo: 70, aeo: 50, geo: 40, brand: 80 }, openIssues: { critical: 1, high: 2, medium: 0, low: 0, info: 0, total: 3 } }),
        snap("2026-10-04T23:59:00Z", { kind: "visibility", overallScore: 64, visibility: vis(0.25) }),
      ],
      [],
      "2026-10-01",
      "2026-10-05",
    );
    expect(rows.map((r) => r.overall_score)).toEqual([null, 60, 60, 64, 64]);
    expect(rows.map((r) => r.ai_mention_rate)).toEqual([null, null, null, 0.25, 0.25]);
    expect(rows[1].seo_score).toBe(70);
    expect(rows[4].seo_score).toBe(70); // the visibility snapshot had no pillar scores: keep the last known
    expect(rows[4].issues_open).toBe(3);
    expect(rows[0].gsc_clicks).toBeNull();
  });

  it("uses snapshots before the range as the starting point, and ignores AI snapshots with no answers", () => {
    const rows = buildLookerRows(
      [snap("2026-09-01T00:00:00Z", { overallScore: 50, visibility: vis(0.4) }), snap("2026-10-01T05:00:00Z", { visibility: vis(0.9, 0) })],
      [],
      "2026-10-01",
      "2026-10-01",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].overall_score).toBe(50);
    expect(rows[0].ai_mention_rate).toBe(0.4);
  });

  it("fills Search Console columns only for days with stored data", () => {
    const rows = buildLookerRows(
      [],
      [
        { date: "2026-10-02", clicks: 10, impressions: 200, ctr: null, position: 12.3456 },
        { date: "2026-10-03", clicks: 5, impressions: 100, ctr: 0.05, position: null },
      ],
      "2026-10-01",
      "2026-10-03",
    );
    expect(rows[0]).toMatchObject({ gsc_clicks: null, gsc_impressions: null, gsc_ctr: null, gsc_position: null });
    expect(rows[1]).toMatchObject({ gsc_clicks: 10, gsc_impressions: 200, gsc_ctr: 0.05, gsc_position: 12.35 });
    expect(rows[2]).toMatchObject({ gsc_ctr: 0.05, gsc_position: null });
  });

  it("declares a field for every row column", () => {
    const row = buildLookerRows([], [], "2026-10-01", "2026-10-01")[0];
    expect(LOOKER_FIELDS.map((f) => f.name).sort()).toEqual(Object.keys(row).sort());
  });
});
