import { describe, expect, it } from "vitest";
import {
  buildPortfolioRows,
  filterPortfolio,
  needsAttention,
  shouldSuggestPortfolio,
  sortPortfolio,
  summarisePortfolio,
  type PortfolioInput,
  type PortfolioSnapshotRow,
} from "@/lib/portfolio/build";

const d = (s: string) => new Date(s);

function snap(projectId: string, o: Partial<PortfolioSnapshotRow>): PortfolioSnapshotRow {
  return {
    projectId,
    kind: "crawl",
    crawlRunId: null,
    overallScore: null,
    grade: null,
    pillarScores: null,
    openIssues: null,
    visibility: null,
    simulated: false,
    createdAt: d("2026-11-01T00:00:00Z"),
    ...o,
  };
}

function input(over: Partial<PortfolioInput> = {}): PortfolioInput {
  return {
    projects: [
      { id: "a", name: "Acme", websiteUrl: "https://www.acme.example", createdAt: d("2026-01-01") },
      { id: "b", name: "Bolt", websiteUrl: "https://bolt.example", createdAt: d("2026-02-01") },
      { id: "c", name: "Cove", websiteUrl: "https://cove.example", createdAt: d("2026-03-01") },
    ],
    snapshots: [
      // Acme: latest is an AI-check snapshot carrying crawl c2's scores; previous website check c1 scored 60.
      snap("a", {
        kind: "visibility", crawlRunId: "c2", overallScore: 70, grade: "C", createdAt: d("2026-11-05"),
        pillarScores: { seo: 80, aeo: 60, geo: 55, brand: null }, openIssues: { critical: 1, high: 2, medium: 5, total: 8 },
        visibility: { mentionRate: 0.25, visibilityIndex: 30, sampleSize: 20 },
      }),
      snap("a", { crawlRunId: "c2", overallScore: 68, createdAt: d("2026-11-04") }),
      snap("a", { crawlRunId: "c1", overallScore: 60, createdAt: d("2026-10-01") }),
      // Bolt: simulated AI data must not show as a mention rate.
      snap("b", {
        crawlRunId: "b1", overallScore: 90, createdAt: d("2026-11-03"), simulated: true,
        openIssues: { critical: 0, high: 0, total: 1 }, visibility: { mentionRate: 0.9, visibilityIndex: 80, sampleSize: 10 },
      }),
    ],
    lastCrawlAt: new Map([["a", d("2026-11-04")], ["b", d("2026-11-03")]]),
    lastAiCheckAt: new Map([["a", d("2026-11-05")]]),
    activeCrawls: new Set(["c"]),
    activeAiChecks: new Set(["c", "b"]),
    monthly: new Map([["a", "sent"], ["b", "draft"]]),
    ...over,
  };
}

describe("buildPortfolioRows", () => {
  const rows = buildPortfolioRows(input());
  const [a, b, c] = rows;

  it("uses the latest snapshot and compares with the previous website check", () => {
    expect(a.score).toBe(70);
    expect(a.scoreChange).toBe(10);
    expect(a.pillars).toEqual({ seo: 80, aeo: 60, geo: 55, brand: null });
    expect(a.urgent).toBe(3);
    expect(a.openTotal).toBe(8);
    expect(a.mentionRate).toBe(0.25);
    expect(a.host).toBe("acme.example");
    expect(a.monthly).toBe("sent");
    expect(a.lastCheckAt).toBe(d("2026-11-04").toISOString());
  });

  it("hides simulated AI data and has no change without a previous check", () => {
    expect(b.mentionRate).toBeNull();
    expect(b.scoreChange).toBeNull();
    expect(b.urgent).toBe(0);
    expect(b.monthly).toBe("draft");
    expect(b.running).toBe("ai");
  });

  it("handles a never-checked project", () => {
    expect(c).toMatchObject({ score: null, scoreChange: null, urgent: null, mentionRate: null, lastCheckAt: null, running: "both", monthly: "none" });
  });

  it("summarises", () => {
    expect(summarisePortfolio(rows)).toEqual({ sites: 3, averageScore: 80, needsAttention: 1, running: 2, monthlyNotSent: 2 });
    expect(needsAttention(a)).toBe(true);
    expect(needsAttention({ ...b, scoreChange: -6 })).toBe(true);
  });

  it("filters and sorts with empty values last", () => {
    expect(filterPortfolio(rows, { q: "bolt" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterPortfolio(rows, { q: "acme.ex" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPortfolio(rows, { filter: "attention" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPortfolio(rows, { filter: "never_checked" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterPortfolio(rows, { filter: "running" }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterPortfolio(rows, { filter: "monthly_pending" }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(sortPortfolio(rows, "score", "asc").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sortPortfolio(rows, "score", "desc").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortPortfolio(rows, "name", "desc").map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(sortPortfolio(rows, "urgent", "desc").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("shouldSuggestPortfolio", () => {
  it("is true from 2 websites", () => {
    expect(shouldSuggestPortfolio(0)).toBe(false);
    expect(shouldSuggestPortfolio(1)).toBe(false);
    expect(shouldSuggestPortfolio(2)).toBe(true);
  });
});
