// Search performance summary from stored MetricDaily rows (real first-party Google data only; never simulated).
import { db } from "@/lib/db";
import { PRODUCT_LABEL } from "./config";
import { readGoogleConfig } from "./integration";
import { AI_REFERRERS, addDays, ymd } from "./sync";

export interface Change {
  abs: number;
  /** Relative change (0.25 = +25%); null when the previous value was 0. */
  pct: number | null;
}

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface TopRow {
  key: string;
  clicks: number;
  impressions: number;
  position: number | null;
  previousClicks: number;
  clicksChange: number;
}

export interface Ga4Totals {
  sessions: number;
  conversions: number;
  aiSessions: number;
}

export interface SearchSummary {
  range: { from: string; to: string; previousFrom: string; previousTo: string; days: number };
  gsc: {
    label: string;
    connected: boolean;
    siteUrl: string | null;
    health: string;
    lastSyncAt: string | null;
    hasData: boolean;
    lastDataDate: string | null;
    current: GscTotals;
    previous: GscTotals;
    deltas: { clicks: Change; impressions: Change; ctr: number | null; position: number | null };
    daily: { date: string; clicks: number; impressions: number }[];
    topQueries: TopRow[];
    topPages: TopRow[];
    /** Queries with clicks this period and none in the previous period. */
    queriesWon: TopRow[];
  } | null;
  ga4: {
    label: string;
    connected: boolean;
    propertyId: string | null;
    propertyName: string | null;
    health: string;
    lastSyncAt: string | null;
    hasData: boolean;
    current: Ga4Totals;
    previous: Ga4Totals;
    deltas: { sessions: Change; conversions: Change; aiSessions: Change };
    daily: { date: string; sessions: number; aiSessions: number }[];
    aiBySource: { source: string; label: string; sessions: number; previousSessions: number }[];
    channels: { channel: string; sessions: number; previousSessions: number }[];
  } | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

export function toDateString(d: Date | string): string {
  if (typeof d === "string") {
    if (!DATE_RE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) throw new Error(`Invalid date ${d}`);
    return d;
  }
  return ymd(d);
}

export function change(cur: number, prev: number): Change {
  return { abs: cur - prev, pct: prev > 0 ? (cur - prev) / prev : null };
}

/** Same-length period immediately before [from, to] (inclusive dates). */
export function previousPeriod(from: string, to: string): { previousFrom: string; previousTo: string; days: number } {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
  return { previousTo: addDays(from, -1), previousFrom: addDays(from, -days), days };
}

interface DailyRow {
  source: string;
  date: string;
  dimension: string;
  key: string;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
  sessions: number | null;
  conversions: number | null;
}

export function gscTotals(rows: Pick<DailyRow, "clicks" | "impressions" | "position">[]): GscTotals {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  let posWeight = 0;
  for (const r of rows) {
    clicks += r.clicks ?? 0;
    impressions += r.impressions ?? 0;
    if (r.position != null && (r.impressions ?? 0) > 0) {
      posWeighted += r.position * (r.impressions ?? 0);
      posWeight += r.impressions ?? 0;
    }
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: posWeight > 0 ? Math.round((posWeighted / posWeight) * 10) / 10 : null,
  };
}

function sumBy<T>(rows: T[], f: (r: T) => number | null | undefined) {
  return rows.reduce((s, r) => s + (f(r) ?? 0), 0);
}

/** Merge current-period top keys with their previous-period clicks. */
export function mergeTop(
  current: { key: string; clicks: number; impressions: number; position: number | null }[],
  previous: Map<string, number>,
): TopRow[] {
  return current.map((c) => {
    const p = previous.get(c.key) ?? 0;
    return { ...c, previousClicks: p, clicksChange: c.clicks - p };
  });
}

async function topKeys(
  organizationId: string, projectId: string, dimension: "query" | "page", from: string, to: string, prevFrom: string, prevTo: string, take: number,
): Promise<TopRow[]> {
  const base = { organizationId, projectId, source: "gsc", dimension };
  const cur = await db.metricDaily.groupBy({
    by: ["key"],
    where: { ...base, date: { gte: from, lte: to } },
    _sum: { clicks: true, impressions: true },
    _avg: { position: true },
    orderBy: { _sum: { clicks: "desc" } },
    take,
  });
  const keys = cur.map((c) => c.key);
  const prev = keys.length
    ? await db.metricDaily.groupBy({
        by: ["key"],
        where: { ...base, key: { in: keys }, date: { gte: prevFrom, lte: prevTo } },
        _sum: { clicks: true },
      })
    : [];
  return mergeTop(
    cur.map((c) => ({
      key: c.key,
      clicks: c._sum?.clicks ?? 0,
      impressions: c._sum?.impressions ?? 0,
      position: c._avg?.position != null ? Math.round(c._avg.position * 10) / 10 : null,
    })),
    new Map(prev.map((p) => [p.key, p._sum?.clicks ?? 0])),
  );
}

export interface SummaryOptions {
  /** Explicit comparison period (e.g. the previous calendar month); defaults to the same-length period before. */
  previous?: { from: Date | string; to: Date | string };
  topN?: number;
}

/**
 * Clicks, impressions, CTR and position (GSC) and sessions + AI-referred sessions (GA4) for [from, to] (inclusive
 * UTC dates) vs the previous period. Tenant-scoped by organizationId. Sections are null when never connected and no data.
 */
export async function getSearchSummary(
  projectId: string,
  organizationId: string,
  fromIn: Date | string,
  toIn: Date | string,
  o: SummaryOptions = {},
): Promise<SearchSummary> {
  const from = toDateString(fromIn);
  const to = toDateString(toIn);
  if (from > to) throw new Error("from must be on or before to");
  const auto = previousPeriod(from, to);
  const previousFrom = o.previous ? toDateString(o.previous.from) : auto.previousFrom;
  const previousTo = o.previous ? toDateString(o.previous.to) : auto.previousTo;
  const topN = o.topN ?? 10;
  const lo = previousFrom < from ? previousFrom : from;
  const hi = previousTo > to ? previousTo : to;

  const [integrations, rows] = await Promise.all([
    db.integration.findMany({
      where: { organizationId, projectId, provider: { in: ["gsc", "ga4"] } },
      select: { provider: true, credentialEncrypted: true, config: true, health: true, lastSyncAt: true },
    }),
    db.metricDaily.findMany({
      where: { organizationId, projectId, dimension: { in: ["total", "channel", "ai_referrer"] }, date: { gte: lo, lte: hi } },
      select: { source: true, date: true, dimension: true, key: true, clicks: true, impressions: true, position: true, sessions: true, conversions: true },
    }),
  ]);
  const inCur = (r: DailyRow) => r.date >= from && r.date <= to;
  const inPrev = (r: DailyRow) => r.date >= previousFrom && r.date <= previousTo;
  const range = { from, to, previousFrom, previousTo, days: auto.days };
  const integ = (p: string) => integrations.find((i) => i.provider === p) ?? null;

  // ---- GSC ----
  let gsc: SearchSummary["gsc"] = null;
  const gi = integ("gsc");
  const gTotal = rows.filter((r) => r.source === "gsc" && r.dimension === "total");
  if (gi || gTotal.length) {
    const cur = gTotal.filter(inCur);
    const prev = gTotal.filter(inPrev);
    const ct = gscTotals(cur);
    const pt = gscTotals(prev);
    const [topQueries, topPages] = cur.length
      ? await Promise.all([
          topKeys(organizationId, projectId, "query", from, to, previousFrom, previousTo, Math.max(topN, 50)),
          topKeys(organizationId, projectId, "page", from, to, previousFrom, previousTo, topN),
        ])
      : [[], []];
    const cfg = readGoogleConfig(gi?.config);
    gsc = {
      label: PRODUCT_LABEL.gsc,
      connected: Boolean(gi?.credentialEncrypted),
      siteUrl: cfg.siteUrl ?? null,
      health: gi?.health ?? "unknown",
      lastSyncAt: gi?.lastSyncAt?.toISOString() ?? null,
      hasData: cur.length > 0,
      lastDataDate: cur.length ? cur.map((r) => r.date).sort().at(-1)! : null,
      current: ct,
      previous: pt,
      deltas: {
        clicks: change(ct.clicks, pt.clicks),
        impressions: change(ct.impressions, pt.impressions),
        ctr: ct.ctr != null && pt.ctr != null ? ct.ctr - pt.ctr : null,
        position: ct.position != null && pt.position != null ? Math.round((ct.position - pt.position) * 10) / 10 : null,
      },
      daily: cur
        .map((r) => ({ date: r.date, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topQueries: topQueries.slice(0, topN),
      topPages,
      queriesWon: topQueries.filter((q) => q.clicks > 0 && q.previousClicks === 0).slice(0, topN),
    };
  }

  // ---- GA4 ----
  let ga4: SearchSummary["ga4"] = null;
  const ai = integ("ga4");
  const aRows = rows.filter((r) => r.source === "ga4");
  if (ai || aRows.length) {
    const tot = aRows.filter((r) => r.dimension === "total");
    const ref = aRows.filter((r) => r.dimension === "ai_referrer");
    const ch = aRows.filter((r) => r.dimension === "channel");
    const totals = (pred: (r: DailyRow) => boolean): Ga4Totals => ({
      sessions: sumBy(tot.filter(pred), (r) => r.sessions),
      conversions: sumBy(tot.filter(pred), (r) => r.conversions),
      aiSessions: sumBy(ref.filter(pred), (r) => r.sessions),
    });
    const ct = totals(inCur);
    const pt = totals(inPrev);
    const days = new Map<string, { date: string; sessions: number; aiSessions: number }>();
    for (const r of tot.filter(inCur)) days.set(r.date, { date: r.date, sessions: r.sessions ?? 0, aiSessions: 0 });
    for (const r of ref.filter(inCur)) {
      const d = days.get(r.date) ?? { date: r.date, sessions: 0, aiSessions: 0 };
      d.aiSessions += r.sessions ?? 0;
      days.set(r.date, d);
    }
    const aiBySource = AI_REFERRERS.map((a) => ({
      source: a.host,
      label: a.label,
      sessions: sumBy(ref.filter((r) => r.key === a.host && inCur(r)), (r) => r.sessions),
      previousSessions: sumBy(ref.filter((r) => r.key === a.host && inPrev(r)), (r) => r.sessions),
    }))
      .filter((x) => x.sessions > 0 || x.previousSessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
    const chMap = new Map<string, { channel: string; sessions: number; previousSessions: number }>();
    for (const r of ch) {
      const c = chMap.get(r.key) ?? { channel: r.key, sessions: 0, previousSessions: 0 };
      if (inCur(r)) c.sessions += r.sessions ?? 0;
      else if (inPrev(r)) c.previousSessions += r.sessions ?? 0;
      chMap.set(r.key, c);
    }
    const cfg = readGoogleConfig(ai?.config);
    ga4 = {
      label: PRODUCT_LABEL.ga4,
      connected: Boolean(ai?.credentialEncrypted),
      propertyId: cfg.propertyId ?? null,
      propertyName: cfg.propertyName ?? null,
      health: ai?.health ?? "unknown",
      lastSyncAt: ai?.lastSyncAt?.toISOString() ?? null,
      hasData: tot.some(inCur),
      current: ct,
      previous: pt,
      deltas: {
        sessions: change(ct.sessions, pt.sessions),
        conversions: change(ct.conversions, pt.conversions),
        aiSessions: change(ct.aiSessions, pt.aiSessions),
      },
      daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      aiBySource,
      channels: [...chMap.values()].filter((c) => c.sessions > 0 || c.previousSessions > 0).sort((a, b) => b.sessions - a.sessions).slice(0, 8),
    };
  }

  return { range, gsc, ga4 };
}
