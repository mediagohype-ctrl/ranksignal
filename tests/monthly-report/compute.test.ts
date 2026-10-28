import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_NOTE, buildHeadline, buildPlan, classifyIssues, competitorShareRows, initialStatus, likeForLike, normalizeSnapshot,
  pickStartEnd, promptsWonLost, rates, scoreDeltas, templateMonthlySummary, type FindingRow, type RunObs, type Snap,
} from "@/lib/monthly-report/compute";
import { FORBIDDEN_CLAIMS } from "@/lib/report/summary";
import type { MonthlyReportPayload } from "@/lib/monthly-report/types";

const range = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") };
const snap = (iso: string, overall: number, extra: Partial<Snap> = {}): Snap => ({
  at: new Date(iso), overall, grade: null, pillars: { seo: overall, aeo: null, geo: overall - 10, brand: null }, simulated: false, ...extra,
});
const obs = (promptId: string, mentioned: boolean, o: Partial<RunObs> = {}): RunObs => ({
  promptId, promptText: `Question ${promptId}`, engine: "ChatGPT", mentioned, cited: false, recommended: false, competitorMentions: {}, ...o,
});

describe("normalizeSnapshot", () => {
  it("reads a SnapshotView-shaped object", () => {
    const s = normalizeSnapshot({
      createdAt: new Date("2026-10-05T00:00:00Z"), overallScore: 61, grade: "D", simulated: false,
      pillarScores: { seo: 70, aeo: 50, geo: null, brand: 40 },
    });
    expect(s).toMatchObject({ overall: 61, grade: "D", pillars: { seo: 70, aeo: 50, geo: null, brand: 40 } });
  });
  it("returns null without a timestamp", () => {
    expect(normalizeSnapshot({ overallScore: 1 })).toBeNull();
  });
});

describe("pickStartEnd", () => {
  it("uses the last snapshot before the month as the baseline and the last in-month snapshot as the end", () => {
    const r = pickStartEnd(
      [snap("2026-09-20T00:00:00Z", 50), snap("2026-09-28T00:00:00Z", 52), snap("2026-10-10T00:00:00Z", 58), snap("2026-10-30T00:00:00Z", 63)],
      range,
    );
    expect(r.start?.overall).toBe(52);
    expect(r.end?.overall).toBe(63);
    expect(r.baselineFromPreviousPeriod).toBe(true);
  });
  it("falls back to the first in-month snapshot when there is no baseline", () => {
    const r = pickStartEnd([snap("2026-10-02T00:00:00Z", 40), snap("2026-10-29T00:00:00Z", 45)], range);
    expect(r.start?.overall).toBe(40);
    expect(r.end?.overall).toBe(45);
    expect(r.baselineFromPreviousPeriod).toBe(false);
  });
  it("has no start when only one snapshot exists in the month", () => {
    const r = pickStartEnd([snap("2026-10-15T00:00:00Z", 40)], range);
    expect(r.start).toBeNull();
    expect(r.end?.overall).toBe(40);
  });
  it("ignores simulated and next-month snapshots", () => {
    const r = pickStartEnd(
      [snap("2026-10-03T00:00:00Z", 40), snap("2026-10-20T00:00:00Z", 99, { simulated: true }), snap("2026-11-01T00:00:00Z", 80), snap("2026-10-25T00:00:00Z", 44)],
      range,
    );
    expect(r.end?.overall).toBe(44);
  });
  it("computes score deltas, null when a side is missing", () => {
    const d = scoreDeltas(snap("2026-09-30T00:00:00Z", 50), snap("2026-10-30T00:00:00Z", 57));
    expect(d.overallDelta).toBe(7);
    expect(d.pillars.find((p) => p.pillar === "seo")?.delta).toBe(7);
    expect(d.pillars.find((p) => p.pillar === "aeo")?.delta).toBeNull();
    expect(scoreDeltas(null, snap("2026-10-30T00:00:00Z", 57)).overallDelta).toBeNull();
  });
});

describe("AI visibility math", () => {
  const start = [obs("p1", false), obs("p2", true), obs("p3", true), obs("p4", false)];
  const end = [obs("p1", true, { competitorMentions: { Rival: 1 } }), obs("p2", false, { competitorMentions: { Rival: 2 } }), obs("p3", true), obs("p5", true)];

  it("finds prompts won and lost by prompt id, only among prompts in both runs", () => {
    const r = promptsWonLost(start, end, "Acme");
    expect(r.won.map((x) => x.promptId)).toEqual(["p1"]);
    expect(r.lost.map((x) => x.promptId)).toEqual(["p2"]);
    expect(r.lost[0]!.competitors).toEqual(["Rival"]);
    // p4 only in start and p5 only in end are not counted either way
  });

  it("treats a prompt as mentioned when any engine mentioned the brand", () => {
    const s = [obs("p1", false, { engine: "A" }), obs("p1", false, { engine: "B" })];
    const e = [obs("p1", false, { engine: "A" }), obs("p1", true, { engine: "B" })];
    expect(promptsWonLost(s, e, "Acme").won).toHaveLength(1);
  });

  it("computes like-for-like rates on matched (prompt, engine) pairs", () => {
    const l = likeForLike(start, end)!;
    expect(l.prompts).toBe(3);
    expect(l.start.mentionRate).toBeCloseTo(2 / 3, 3);
    expect(l.end.mentionRate).toBeCloseTo(2 / 3, 3);
    expect(likeForLike([obs("x", true)], [obs("y", true)])).toBeNull();
  });

  it("computes overall rates", () => {
    expect(rates(end)).toMatchObject({ answers: 4, mentionRate: 0.75, citationRate: 0 });
    expect(rates([]).mentionRate).toBeNull();
  });

  it("computes competitor share with the brand first", () => {
    const rows = competitorShareRows(start, end, "Acme");
    expect(rows[0]).toMatchObject({ name: "Acme", isBrand: true, start: 1 });
    const rival = rows.find((r) => r.name === "Rival")!;
    expect(rival.start).toBe(0);
    expect(rival.end).toBeCloseTo(2 / 5, 3);
  });
});

describe("classifyIssues", () => {
  const f = (o: Partial<FindingRow>): FindingRow => ({
    code: "missing_meta", severity: "medium", message: "Missing meta description. More text.", status: "open",
    detectedAt: new Date("2026-08-01T00:00:00Z"), resolvedAt: null, ...o,
  });
  it("separates fixed, new and open-at-end", () => {
    const r = classifyIssues(
      [
        f({ status: "resolved", resolvedAt: new Date("2026-10-12T00:00:00Z") }), // fixed this month
        f({ status: "resolved", resolvedAt: new Date("2026-09-12T00:00:00Z") }), // fixed last month: ignored
        f({ code: "broken_link", severity: "high", detectedAt: new Date("2026-10-05T00:00:00Z") }), // new + open
        f({ code: "h1", severity: "low" }), // old, still open
        f({ code: "late", status: "resolved", resolvedAt: new Date("2026-11-03T00:00:00Z") }), // open at month end
        f({ code: "nov", detectedAt: new Date("2026-11-02T00:00:00Z") }), // detected after period: excluded
        f({ code: "ign", status: "ignored", detectedAt: new Date("2026-10-05T00:00:00Z") }), // ignored: excluded
      ],
      range,
    );
    expect(r.fixed.total).toBe(1);
    expect(r.fixed.top[0]!.title).toBe("Missing meta description.");
    expect(r.new.total).toBe(1);
    expect(r.new.top[0]!.code).toBe("broken_link");
    expect(r.openBySeverity).toMatchObject({ high: 1, low: 1, medium: 1, total: 3 });
  });
});

describe("plan + status + headline", () => {
  it("adds report issues not already covered by open tasks", () => {
    const plan = buildPlan(
      [{ title: "Fix missing page descriptions", status: "in_progress", category: "onsite", dueAt: null }],
      [{ title: "Missing page descriptions", impact: "high" }, { title: "No FAQ schema", impact: "medium" }],
    );
    expect(plan.map((p) => p.source)).toEqual(["task", "report"]);
    expect(plan[1]!.title).toBe("No FAQ schema");
  });

  it("service clients get a draft; self-serve is sent", () => {
    expect(initialStatus("grow")).toBe("draft");
    expect(initialStatus("fix")).toBe("draft");
    expect(initialStatus(null)).toBe("sent");
    expect(initialStatus("")).toBe("sent");
  });

  it("builds an honest headline and template summary without guarantees", () => {
    const base: Omit<MonthlyReportPayload, "headline" | "attribution"> = {
      version: "monthly-1", period: "2026-10", periodLabel: "October 2026",
      range: { start: range.start.toISOString(), end: range.end.toISOString(), timezone: "UTC" },
      generatedAt: "2026-11-01T00:00:00Z",
      project: { id: "p", name: "Acme", brand: "Acme", domain: "acme.test", websiteUrl: "https://acme.test" },
      serviceTier: "grow",
      dataSources: { crawlSnapshots: 2, visibilitySnapshots: 2, visibilityRuns: 2, providers: ["ChatGPT"], summarySource: "template" },
      scores: {
        start: { at: null, overall: 50, grade: null }, end: { at: null, overall: 58, grade: null }, overallDelta: 8,
        pillars: [], baselineFromPreviousPeriod: true,
      },
      aiVisibility: {
        measured: true, startRunAt: null, endRunAt: null,
        start: { answers: 10, mentionRate: 0.2, citationRate: 0.1, recommendationRate: 0 },
        end: { answers: 10, mentionRate: 0.4, citationRate: 0.1, recommendationRate: 0 },
        likeForLike: null, engines: [], competitorShare: [],
        promptsWon: [{ promptId: "a", prompt: "q", competitors: [] }], promptsLost: [],
      },
      issues: { fixed: { total: 4, top: [] }, new: { total: 0, top: [] }, openBySeverity: { critical: 0, high: 2, medium: 0, low: 0, info: 0, total: 2 } },
      work: { shipped: [], byPerformer: { agency: 0, client: 0, system: 0 } },
      nextMonth: [{ title: "Add FAQ", source: "task" }],
      wrongAnswers: [], notes: [],
    };
    const h = buildHeadline(base);
    expect(h.gains[0]).toContain("50 → 58");
    expect(h.gains.length).toBeLessThanOrEqual(3);
    expect(h.risks.join(" ")).toContain("2 critical or high-priority issues");
    expect(h.nextActions[0]).toBe("Add FAQ");
    const text = templateMonthlySummary({ ...base, headline: h });
    const sentences = text.split(/[.!?](?:\s|$)/).filter((s) => s.trim());
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    expect(sentences.length).toBeLessThanOrEqual(6);
    expect(FORBIDDEN_CLAIMS.test(text)).toBe(false);
    expect(ATTRIBUTION_NOTE).toMatch(/correlation/);
  });
});
