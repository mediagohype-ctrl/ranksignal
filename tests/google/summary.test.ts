// getSearchSummary over stored MetricDaily rows: totals, weighted position, deltas vs the previous period,
// top queries with change, queries won, GA4 sessions + AI-referred sessions, and tenant scoping.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeState } from "./fake-db";

const h = vi.hoisted(() => ({ state: null as unknown as FakeState }));
vi.mock("@/lib/db", async () => {
  const f = await import("./fake-db");
  h.state = f.newState();
  return { db: f.makeDb(h.state) };
});

import { change, gscTotals, getSearchSummary, previousPeriod } from "@/lib/google/summary";
import { searchHeadlineLines, searchSectionFrom } from "@/lib/monthly-report/compute";

let n = 0;
const m = (o: Record<string, unknown>) =>
  h.state.metrics.push({ id: `m${++n}`, organizationId: "o1", projectId: "p1", key: "", clicks: null, impressions: null, ctr: null, position: null, sessions: null, conversions: null, ...o });

beforeEach(async () => {
  const f = await import("./fake-db");
  Object.assign(h.state, f.newState());
  h.state.integrations.push(
    { id: "g", organizationId: "o1", projectId: "p1", provider: "gsc", credentialEncrypted: "x", config: { siteUrl: "sc-domain:acme.test" }, health: "healthy", lastSyncAt: new Date("2026-10-29T00:00:00Z") },
    { id: "a", organizationId: "o1", projectId: "p1", provider: "ga4", credentialEncrypted: "x", config: { propertyId: "properties/1", propertyName: "Acme" }, health: "healthy", lastSyncAt: null },
  );
  // Previous period (Sep 24-30) and current period (Oct 1-7).
  for (const d of ["2026-09-29", "2026-09-30"]) {
    m({ source: "gsc", date: d, dimension: "total", clicks: 10, impressions: 200, position: 10 });
    m({ source: "gsc", date: d, dimension: "query", key: "acme shoes", clicks: 10, impressions: 200, position: 10 });
    m({ source: "ga4", date: d, dimension: "total", sessions: 100, conversions: 1 });
    m({ source: "ga4", date: d, dimension: "ai_referrer", key: "chatgpt.com", sessions: 1 });
  }
  for (const d of ["2026-10-01", "2026-10-02"]) {
    m({ source: "gsc", date: d, dimension: "total", clicks: 20, impressions: 300, position: 6 });
    m({ source: "gsc", date: d, dimension: "query", key: "acme shoes", clicks: 15, impressions: 200, position: 5 });
    m({ source: "gsc", date: d, dimension: "query", key: "buy running shoes", clicks: 5, impressions: 100, position: 8 });
    m({ source: "gsc", date: d, dimension: "page", key: "https://acme.test/", clicks: 20, impressions: 300, position: 6 });
    m({ source: "ga4", date: d, dimension: "total", sessions: 150, conversions: 3 });
    m({ source: "ga4", date: d, dimension: "channel", key: "Organic Search", sessions: 90 });
    m({ source: "ga4", date: d, dimension: "ai_referrer", key: "chatgpt.com", sessions: 3 });
    m({ source: "ga4", date: d, dimension: "ai_referrer", key: "perplexity.ai", sessions: 2 });
  }
  // Another tenant's rows must never leak in.
  h.state.metrics.push({ id: "x1", organizationId: "o2", projectId: "p1", source: "gsc", date: "2026-10-01", dimension: "total", key: "", clicks: 999, impressions: 999, position: 1 });
});

describe("pure helpers", () => {
  it("computes previous periods and changes", () => {
    expect(previousPeriod("2026-10-01", "2026-10-07")).toEqual({ previousFrom: "2026-09-24", previousTo: "2026-09-30", days: 7 });
    expect(change(15, 10)).toEqual({ abs: 5, pct: 0.5 });
    expect(change(3, 0)).toEqual({ abs: 3, pct: null });
  });

  it("weights position by impressions", () => {
    const t = gscTotals([
      { clicks: 1, impressions: 100, position: 2 },
      { clicks: 1, impressions: 300, position: 10 },
    ]);
    expect(t).toEqual({ clicks: 2, impressions: 400, ctr: 0.005, position: 8 });
  });
});

describe("getSearchSummary", () => {
  it("returns totals, deltas, top queries and AI-referred sessions", async () => {
    const s = await getSearchSummary("p1", "o1", "2026-10-01", "2026-10-07");
    expect(s.range).toMatchObject({ previousFrom: "2026-09-24", previousTo: "2026-09-30", days: 7 });
    const g = s.gsc!;
    expect(g.connected).toBe(true);
    expect(g.siteUrl).toBe("sc-domain:acme.test");
    expect(g.current).toEqual({ clicks: 40, impressions: 600, ctr: 40 / 600, position: 6 });
    expect(g.previous).toMatchObject({ clicks: 20, impressions: 400, position: 10 });
    expect(g.deltas.clicks).toEqual({ abs: 20, pct: 1 });
    expect(g.deltas.impressions).toEqual({ abs: 200, pct: 0.5 });
    expect(g.deltas.position).toBe(-4);
    expect(g.daily.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(g.lastDataDate).toBe("2026-10-02");
    expect(g.topQueries[0]).toMatchObject({ key: "acme shoes", clicks: 30, previousClicks: 20, clicksChange: 10 });
    expect(g.queriesWon.map((q) => q.key)).toEqual(["buy running shoes"]);
    expect(g.topPages[0]!.key).toBe("https://acme.test/");

    const a = s.ga4!;
    expect(a.current).toEqual({ sessions: 300, conversions: 6, aiSessions: 10 });
    expect(a.previous).toEqual({ sessions: 200, conversions: 2, aiSessions: 2 });
    expect(a.deltas.aiSessions).toEqual({ abs: 8, pct: 4 });
    expect(a.aiBySource.map((x) => [x.label, x.sessions, x.previousSessions])).toEqual([["ChatGPT", 6, 2], ["Perplexity", 4, 0]]);
    expect(a.channels[0]).toMatchObject({ channel: "Organic Search", sessions: 180 });
    expect(a.daily[0]).toEqual({ date: "2026-10-01", sessions: 150, aiSessions: 5 });
  });

  it("is null per source when never connected and no data", async () => {
    const s = await getSearchSummary("p2", "o1", "2026-10-01", "2026-10-07");
    expect(s.gsc).toBeNull();
    expect(s.ga4).toBeNull();
  });

  it("accepts an explicit comparison period", async () => {
    const s = await getSearchSummary("p1", "o1", new Date("2026-10-01T00:00:00Z"), new Date("2026-10-31T00:00:00Z"), {
      previous: { from: "2026-09-01", to: "2026-09-30" },
    });
    expect(s.range).toMatchObject({ from: "2026-10-01", to: "2026-10-31", previousFrom: "2026-09-01", previousTo: "2026-09-30" });
    expect(s.gsc!.previous.clicks).toBe(20);
  });
});

describe("monthly report search section", () => {
  it("maps the summary into the report section with honest headline lines", async () => {
    const s = await getSearchSummary("p1", "o1", "2026-10-01", "2026-10-31", { previous: { from: "2026-09-01", to: "2026-09-30" } });
    const sec = searchSectionFrom(s)!;
    expect(sec.gsc!.clicks).toEqual({ previous: 20, current: 40, delta: 20, pct: 1 });
    expect(sec.gsc!.queriesWon).toEqual([{ query: "buy running shoes", clicks: 10, impressions: 200 }]);
    expect(sec.ga4!.aiSessions).toMatchObject({ previous: 2, current: 10 });
    expect(sec.note).toMatch(/not as proof|rather than as proof/);
    const lines = searchHeadlineLines(sec);
    expect(lines.gains).toContain("Clicks from Google search up 100% (20 → 40).");
    expect(lines.gains).toContain("Visits from AI assistants: 2 → 10.");
    expect(lines.risks).toEqual([]);
  });

  it("returns null when nothing is connected or no data", async () => {
    expect(searchSectionFrom({ range: { from: "", to: "", previousFrom: "", previousTo: "", days: 0 }, gsc: null, ga4: null })).toBeNull();
    expect(searchHeadlineLines(null)).toEqual({ gains: [], risks: [] });
  });
});
