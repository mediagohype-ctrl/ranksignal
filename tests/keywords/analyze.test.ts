// Pure keyword maths: periods, per-keyword stats vs previous period, list sort/filter/paging, opportunities,
// position history (daily + weekly), group by page, and CSV export (formula-injection safe).
import { describe, expect, it } from "vitest";
import {
  buildHistory, buildKeywordStats, expectedCtr, findOpportunities, groupByPage, listKeywords, periodsFor, sortKeywords, toKeywordStat,
  weekStart, type KeywordAgg,
} from "@/lib/keywords/analyze";
import { csvCell, keywordsCsv } from "@/lib/keywords/csv";
import { KEYWORD_STAR_LIMITS, keywordStarLimit, parseRangeDays } from "@/lib/keywords/limits";

const agg = (key: string, o: Partial<KeywordAgg> = {}): KeywordAgg => ({
  key, clicks: 0, impressions: 0, posWeighted: 0, posWeight: 0, prevClicks: 0, prevImpressions: 0, prevPosWeighted: 0, prevPosWeight: 0, ...o,
});
/** impressions at a given average position */
const at = (impr: number, pos: number) => ({ impressions: impr, posWeighted: impr * pos, posWeight: impr });
const prevAt = (impr: number, pos: number) => ({ prevImpressions: impr, prevPosWeighted: impr * pos, prevPosWeight: impr });

describe("periods and limits", () => {
  it("builds the current and previous period", () => {
    expect(periodsFor("2026-11-06", 7)).toEqual({ from: "2026-10-31", to: "2026-11-06", previousFrom: "2026-10-24", previousTo: "2026-10-30", days: 7 });
  });
  it("parses ranges and plan limits", () => {
    expect(parseRangeDays("90")).toBe(90);
    expect(parseRangeDays("5")).toBe(28);
    expect(parseRangeDays(null)).toBe(28);
    expect(KEYWORD_STAR_LIMITS).toMatchObject({ starter: 25, growth: 200, agency: 1000 });
    expect(keywordStarLimit("agency")).toBe(1000);
    expect(keywordStarLimit("bogus")).toBe(KEYWORD_STAR_LIMITS.trial);
  });
});

describe("keyword stats", () => {
  it("computes CTR, weighted position and changes (positive position change = worse)", () => {
    const k = toKeywordStat(agg("shoes", { clicks: 10, ...at(200, 4), prevClicks: 20, ...prevAt(100, 2) }));
    expect(k).toMatchObject({ query: "shoes", clicks: 10, impressions: 200, ctr: 0.05, position: 4, clicksChange: -10, positionChange: 2 });
    expect(k.previous).toMatchObject({ clicks: 20, impressions: 100, position: 2 });
  });
  it("marks queries with no previous data", () => {
    const k = toKeywordStat(agg("new", { clicks: 1, ...at(10, 3) }));
    expect(k.previous).toBeNull();
    expect(k.positionChange).toBeNull();
    expect(k.clicksChange).toBe(1);
  });
  it("drops queries only seen in the previous period", () => {
    expect(buildKeywordStats([agg("gone", { prevClicks: 5, ...prevAt(50, 3) }), agg("here", at(5, 3))]).map((k) => k.query)).toEqual(["here"]);
  });
});

describe("list", () => {
  const stats = buildKeywordStats([
    agg("alpha", { clicks: 5, ...at(100, 3) }),
    agg("beta", { clicks: 50, ...at(1000, 9) }),
    agg("gamma shoes", { clicks: 1, ...at(10, 1.5) }),
    agg("delta", { clicks: 0, impressions: 3 }), // no position
  ]);
  it("sorts, with nulls last either direction", () => {
    expect(sortKeywords(stats, "clicks", "desc").map((k) => k.query)).toEqual(["beta", "alpha", "gamma shoes", "delta"]);
    expect(sortKeywords(stats, "position", "asc").map((k) => k.query)).toEqual(["gamma shoes", "alpha", "beta", "delta"]);
    expect(sortKeywords(stats, "position", "desc").at(-1)!.query).toBe("delta");
  });
  it("searches case-insensitively, filters to starred and paginates", () => {
    expect(listKeywords(stats, { search: "SHOES" }).items.map((k) => k.query)).toEqual(["gamma shoes"]);
    expect(listKeywords(stats, { only: new Set(["alpha", "delta"]) }).total).toBe(2);
    const p = listKeywords(stats, { pageSize: 3, page: 2 });
    expect(p).toMatchObject({ total: 4, pages: 2, page: 2 });
    expect(p.items).toHaveLength(1);
    expect(listKeywords(stats, { pageSize: 3, page: 99 }).page).toBe(2);
  });
});

describe("opportunities", () => {
  it("uses a falling expected-CTR curve", () => {
    expect(expectedCtr(1)).toBeCloseTo(0.28);
    expect(expectedCtr(1.5)).toBeGreaterThan(expectedCtr(2));
    expect(expectedCtr(15)).toBe(0.01);
  });

  it("finds almost-page-1, low CTR, losing ground and new keywords with next steps", () => {
    const stats = buildKeywordStats([
      agg("page two", { clicks: 2, ...at(400, 12), prevClicks: 2, ...prevAt(400, 12) }),
      agg("low ctr", { clicks: 2, ...at(500, 2), prevClicks: 2, ...prevAt(500, 2) }),
      agg("dropped", { clicks: 5, ...at(100, 9), prevClicks: 6, ...prevAt(100, 4) }),
      agg("fewer clicks", { clicks: 10, ...at(300, 3), prevClicks: 40, ...prevAt(300, 3) }),
      agg("brand new", { clicks: 1, ...at(50, 6) }),
      agg("tiny", { clicks: 0, ...at(2, 15) }),
    ]);
    const o = findOpportunities(stats, { days: 28, hasPreviousData: true });
    expect(o.almost_page_1.map((x) => x.query)).toEqual(["page two", "dropped"]);
    expect(o.low_ctr.map((x) => x.query)).toEqual(["low ctr", "fewer clicks"]);
    expect(o.low_ctr[0].link?.href).toBe("/tools/seo-title-generator");
    expect(o.losing_ground.map((x) => x.query)).toEqual(["fewer clicks", "dropped"]);
    expect(o.new_keyword.map((x) => x.query)).toEqual(["brand new"]);
    for (const list of Object.values(o)) for (const x of list) expect(x.nextStep.length).toBeGreaterThan(20);
  });

  it("doesn't call everything new before there is previous-period data", () => {
    const stats = buildKeywordStats([agg("x", { clicks: 1, ...at(50, 6) })]);
    expect(findOpportunities(stats, { days: 28, hasPreviousData: false }).new_keyword).toHaveLength(0);
  });

  it("scales thresholds with the period length", () => {
    const stats = buildKeywordStats([agg("q", { clicks: 0, ...at(20, 12) })]);
    expect(findOpportunities(stats, { days: 7, hasPreviousData: false }).almost_page_1).toHaveLength(1);
    expect(findOpportunities(stats, { days: 90, hasPreviousData: false }).almost_page_1).toHaveLength(0);
  });
});

describe("history", () => {
  const rows = [
    { date: "2026-11-02", clicks: 2, impressions: 10, position: 4 },
    { date: "2026-11-04", clicks: 1, impressions: 30, position: 8 },
    { date: "2026-11-09", clicks: 3, impressions: 10, position: 2 },
  ];
  it("fills missing days with zero clicks and no position", () => {
    const h = buildHistory(rows, "2026-11-02", "2026-11-04");
    expect(h).toEqual([
      { date: "2026-11-02", clicks: 2, impressions: 10, position: 4 },
      { date: "2026-11-03", clicks: 0, impressions: 0, position: null },
      { date: "2026-11-04", clicks: 1, impressions: 30, position: 8 },
    ]);
  });
  it("groups weekly (Monday start) with impression-weighted position", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday → Monday before
    const h = buildHistory(rows, "2026-11-02", "2026-11-09", "week");
    expect(h).toEqual([
      { date: "2026-11-02", clicks: 3, impressions: 40, position: 7 },
      { date: "2026-11-09", clicks: 3, impressions: 10, position: 2 },
    ]);
  });
});

describe("group by page", () => {
  it("groups queries under the page that ranks for them", () => {
    const g = groupByPage([
      { query: "a", page: "https://x.test/1", clicks: 1, impressions: 10, position: 3 },
      { query: "b", page: "https://x.test/2", clicks: 5, impressions: 50, position: 2 },
      { query: "c", page: "https://x.test/1", clicks: 3, impressions: 10, position: 1.26 },
    ]);
    expect(g.map((p) => p.page)).toEqual(["https://x.test/2", "https://x.test/1"]);
    expect(g[1]).toMatchObject({ clicks: 4, impressions: 20 });
    expect(g[1].queries.map((q) => q.query)).toEqual(["c", "a"]);
    expect(g[1].queries[0].position).toBe(1.3);
  });
});

describe("csv", () => {
  it("escapes quotes/commas and neutralises formulas but keeps negative numbers", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
  });
  it("exports a header and one row per keyword", () => {
    const csv = keywordsCsv(buildKeywordStats([agg("shoes, red", { clicks: 3, ...at(30, 2.25) })]), { from: "2026-10-01", to: "2026-10-28" });
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Keyword,Clicks,Impressions/);
    expect(lines[1]).toBe('"shoes, red",3,30,10.00,2.3,,,,3,,2026-10-01,2026-10-28');
  });
});
