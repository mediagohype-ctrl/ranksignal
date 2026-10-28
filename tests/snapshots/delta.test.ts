import { describe, expect, it } from "vitest";
import { computeDelta, likeForLikeFromObservations, metricDelta } from "@/lib/snapshots/delta";
import type { SnapshotView } from "@/lib/snapshots/types";

function snap(over: Partial<SnapshotView> = {}): SnapshotView {
  return {
    id: "s1",
    projectId: "p1",
    kind: "crawl",
    crawlRunId: "c1",
    visibilityRunId: "v1",
    createdAt: new Date("2026-09-28T00:00:00Z"),
    overallScore: 60,
    grade: "D",
    pillarScores: { seo: 70, aeo: 50, geo: 40, brand: null },
    openIssues: { critical: 1, high: 4, medium: 6, low: 2, info: 0, total: 13 },
    visibility: {
      mentionRate: 0.2, citationRate: 0.1, recommendationRate: 0.05, visibilityIndex: 13.5,
      competitorShare: {}, sampleSize: 40, collected: 40, providers: ["openai"], formulaVersion: "vi-1",
    },
    promptSetVersion: 1,
    methodologyVersion: "report-1+vi-1",
    simulated: false,
    ...over,
  };
}

describe("metricDelta", () => {
  it("subtracts and nulls missing sides", () => {
    expect(metricDelta(50, 62)).toEqual({ before: 50, after: 62, delta: 12 });
    expect(metricDelta(null, 62)).toEqual({ before: null, after: 62, delta: null });
    expect(metricDelta(0.1, 0.25, true).delta).toBe(0.15);
  });
});

describe("computeDelta", () => {
  it("computes score, pillar, issue and rate deltas", () => {
    const after = snap({
      id: "s2", visibilityRunId: "v2", createdAt: new Date("2026-10-28T00:00:00Z"), overallScore: 68, grade: "C",
      pillarScores: { seo: 75, aeo: 58, geo: 40, brand: 30 },
      openIssues: { critical: 0, high: 2, medium: 6, low: 3, info: 0, total: 11 },
      visibility: { ...snap().visibility!, mentionRate: 0.3, citationRate: 0.05, visibilityIndex: 17 },
    });
    const d = computeDelta(snap(), after, { fixed: 5, new: 3 });
    expect(d.overall).toEqual({ before: 60, after: 68, delta: 8 });
    expect(d.pillars.seo.delta).toBe(5);
    expect(d.pillars.aeo.delta).toBe(8);
    expect(d.pillars.geo.delta).toBe(0);
    expect(d.pillars.brand).toEqual({ before: null, after: 30, delta: null });
    expect(d.issues.total.delta).toBe(-2);
    expect(d.issues.bySeverity.critical.delta).toBe(-1);
    expect(d.issues.fixed).toBe(5);
    expect(d.issues.new).toBe(3);
    expect(d.visibility.mentionRate.delta).toBe(0.1);
    expect(d.visibility.citationRate.delta).toBe(-0.05);
    expect(d.visibility.visibilityIndex.delta).toBe(3.5);
    expect(d.methodologyChanged).toBe(false);
    expect(d.notes).toEqual([]);
  });

  it("handles a null baseline with a note and null deltas", () => {
    const d = computeDelta(null, snap(), { fixed: 4, new: 1 });
    expect(d.from).toBeNull();
    expect(d.overall).toEqual({ before: null, after: 60, delta: null });
    expect(d.pillars.seo.delta).toBeNull();
    expect(d.issues.fixed).toBeNull();
    expect(d.visibility.mentionRate.delta).toBeNull();
    expect(d.notes.some((n) => /No earlier measurement/.test(n))).toBe(true);
  });

  it("handles nothing measured at all", () => {
    const d = computeDelta(null, null);
    expect(d.to).toBeNull();
    expect(d.notes[0]).toMatch(/Nothing has been measured/);
  });

  it("flags methodology, prompt-set, simulated and small-sample changes", () => {
    const after = snap({
      id: "s2", visibilityRunId: "v2", methodologyVersion: "report-2+vi-1", promptSetVersion: 2, simulated: true,
      visibility: { ...snap().visibility!, collected: 12 },
    });
    const d = computeDelta(snap(), after);
    const notes = d.notes.join(" ");
    expect(d.methodologyChanged).toBe(true);
    expect(d.promptSetChanged).toBe(true);
    expect(notes).toMatch(/scoring method changed \(report-1\+vi-1 → report-2\+vi-1\)/);
    expect(notes).toMatch(/AI questions changed \(v1 → v2\).*directly comparable/);
    expect(notes).toMatch(/simulated/);
    expect(notes).toMatch(/small sample \(12 answers\)/);
  });

  it("notes when no new AI check happened", () => {
    const d = computeDelta(snap(), snap({ id: "s2" }));
    expect(d.notes.join(" ")).toMatch(/No new AI visibility check/);
  });

  it("uses like-for-like rates when supplied", () => {
    const lfl = likeForLikeFromObservations(
      "v1", "v2",
      [
        { promptId: "a", brandMentioned: false, brandCited: false, brandRecommended: false },
        { promptId: "b", brandMentioned: true, brandCited: false, brandRecommended: false },
      ],
      [
        { promptId: "a", brandMentioned: true, brandCited: true, brandRecommended: false },
        { promptId: "b", brandMentioned: true, brandCited: false, brandRecommended: true },
        { promptId: "c", brandMentioned: false, brandCited: false, brandRecommended: false },
      ],
    )!;
    const after = snap({ id: "s2", visibilityRunId: "v2", promptSetVersion: 2, visibility: { ...snap().visibility!, mentionRate: 0.9 } });
    const d = computeDelta(snap(), after, { likeForLike: lfl });
    expect(d.visibility.likeForLike).toBe(lfl);
    expect(d.visibility.mentionRate).toEqual({ before: 0.5, after: 1, delta: 0.5 });
    expect(d.visibility.citationRate.delta).toBe(0.5);
    expect(d.notes.join(" ")).toMatch(/compared on the 2 questions asked both times/);
  });
});

describe("likeForLikeFromObservations", () => {
  it("matches only prompt ids present in both runs and reports sample sizes", () => {
    const before = [
      { promptId: "p1", brandMentioned: true, brandCited: true, brandRecommended: false },
      { promptId: "p1", brandMentioned: false, brandCited: false, brandRecommended: false }, // second provider
      { promptId: "p2", brandMentioned: false, brandCited: false, brandRecommended: false },
      { promptId: "old", brandMentioned: true, brandCited: true, brandRecommended: true },
    ];
    const after = [
      { promptId: "p1", brandMentioned: true, brandCited: false, brandRecommended: true },
      { promptId: "p2", brandMentioned: true, brandCited: false, brandRecommended: false },
      { promptId: "new1", brandMentioned: false, brandCited: false, brandRecommended: false },
      { promptId: "new2", brandMentioned: false, brandCited: false, brandRecommended: false },
    ];
    const r = likeForLikeFromObservations("v1", "v2", before, after)!;
    expect(r.promptCount).toBe(2);
    expect(r.excludedPrompts).toEqual({ onlyBefore: 1, onlyAfter: 2 });
    expect(r.before).toEqual({ sampleSize: 3, mentionRate: 0.3333, citationRate: 0.3333, recommendationRate: 0 });
    expect(r.after).toEqual({ sampleSize: 2, mentionRate: 1, citationRate: 0, recommendationRate: 0.5 });
    expect(r.mentionRate.delta).toBe(0.6667);
    expect(r.citationRate.delta).toBe(-0.3333);
    expect(r.recommendationRate.delta).toBe(0.5);
  });

  it("returns null when no prompts overlap", () => {
    expect(
      likeForLikeFromObservations(
        "v1", "v2",
        [{ promptId: "a", brandMentioned: true, brandCited: false, brandRecommended: false }],
        [{ promptId: "b", brandMentioned: true, brandCited: false, brandRecommended: false }],
      ),
    ).toBeNull();
  });
});
