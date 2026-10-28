import { describe, expect, it } from "vitest";
import { computeMetrics, FORMULA_VERSION, type MetricObservation } from "@/lib/visibility/metrics";

const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2026-10-31T00:00:00Z");
const cite = (domain: string, owned = false) => ({ url: `https://${domain}/x`, domain, ownedByCustomer: owned });

const obs: MetricObservation[] = [
  { provider: "openai", brandMentioned: true, brandCited: true, brandRecommended: true, competitorMentions: { Globex: 2 }, citations: [cite("acme.in", true), cite("acme.in", true), cite("wiki.org")], simulated: false },
  { provider: "openai", brandMentioned: true, brandCited: false, brandRecommended: false, competitorMentions: {}, citations: [cite("wiki.org")], simulated: false },
  { provider: "dataforseo", brandMentioned: false, brandCited: false, brandRecommended: false, competitorMentions: { Globex: 1, Initech: 1 }, citations: [], simulated: false },
  { provider: "dataforseo", brandMentioned: false, brandCited: false, brandRecommended: false, simulated: false, ok: false },
];

describe("computeMetrics", () => {
  it("uses successfully collected answers as denominator", () => {
    const m = computeMetrics(obs, { from, to, brandLabel: "Acme" });
    expect(m.sampleSize).toBe(4);
    expect(m.collected).toBe(3);
    expect(m.mentionRate).toBeCloseTo(2 / 3, 4);
    expect(m.citationRate).toBeCloseTo(1 / 3, 4);
    expect(m.recommendationRate).toBeCloseTo(1 / 3, 4);
  });

  it("computes competitor share over brand+competitor answer mentions", () => {
    const m = computeMetrics(obs, { from, to, brandLabel: "Acme" });
    // Acme: 2 answers, Globex: 2 answers, Initech: 1 → total 5
    expect(m.competitorShare).toEqual({ Acme: 0.4, Globex: 0.4, Initech: 0.2 });
  });

  it("dedupes citation sources by domain per answer", () => {
    const m = computeMetrics(obs, { from, to });
    expect(m.citationSources).toEqual([
      { domain: "acme.in", count: 1, owned: true },
      { domain: "wiki.org", count: 2, owned: false },
    ].sort((a, b) => b.count - a.count));
  });

  it("splits by provider and computes the versioned index", () => {
    const m = computeMetrics(obs, { from, to });
    expect(m.byProvider.openai).toEqual({ collected: 2, mentionRate: 1, citationRate: 0.5 });
    expect(m.byProvider.dataforseo).toEqual({ collected: 1, mentionRate: 0, citationRate: 0 });
    const expected = Math.round(100 * (0.45 * 0.6667 + 0.35 * 0.3333 + 0.2 * 0.3333) * 10) / 10;
    expect(m.visibilityIndex).toBeCloseTo(expected, 1);
    expect(m.formulaVersion).toBe(FORMULA_VERSION);
    expect(m.simulated).toBe(false);
    expect(m.window).toEqual({ from: from.toISOString(), to: to.toISOString() });
  });

  it("handles zero sample", () => {
    const m = computeMetrics([], { from, to });
    expect(m).toMatchObject({ sampleSize: 0, collected: 0, mentionRate: 0, citationRate: 0, recommendationRate: 0, visibilityIndex: 0, simulated: false });
    expect(m.competitorShare).toEqual({});
    expect(m.citationSources).toEqual([]);
  });

  it("flags simulated and filters by window", () => {
    const m = computeMetrics(
      [
        { provider: "simulated", brandMentioned: true, brandCited: false, brandRecommended: false, simulated: true, createdAt: "2026-10-05T00:00:00Z" },
        { provider: "simulated", brandMentioned: true, brandCited: false, brandRecommended: false, simulated: true, createdAt: "2026-09-05T00:00:00Z" },
      ],
      { from, to },
    );
    expect(m.simulated).toBe(true);
    expect(m.collected).toBe(1);
  });
});
