// Pure keyword maths over Search Console query rows: per-keyword stats vs the previous period, list filtering,
// opportunities with plain-English next steps, and position history. No I/O here (tested in tests/keywords).
// Safe to import from client components (no server imports).

const DAY = 86_400_000;

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export interface Periods {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  days: number;
}

/** [to - days + 1, to] and the same-length period right before it (inclusive YYYY-MM-DD dates). */
export function periodsFor(to: string, days: number): Periods {
  const from = addDays(to, -(days - 1));
  return { from, to, previousTo: addDays(from, -1), previousFrom: addDays(from, -days), days };
}

/** Sums for one query over the current and previous periods (what the SQL aggregate returns). */
export interface KeywordAgg {
  key: string;
  clicks: number;
  impressions: number;
  /** Σ position × impressions over rows that have a position. */
  posWeighted: number;
  /** Σ impressions over rows that have a position. */
  posWeight: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosWeighted: number;
  prevPosWeight: number;
}

export interface PeriodStat {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface KeywordStat extends PeriodStat {
  query: string;
  /** Null when the query had no impressions in the previous period. */
  previous: PeriodStat | null;
  clicksChange: number;
  /** Current minus previous average position: POSITIVE = WORSE (further down the page). Null without both. */
  positionChange: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function periodStat(clicks: number, impressions: number, posWeighted: number, posWeight: number): PeriodStat {
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: posWeight > 0 ? round1(posWeighted / posWeight) : null,
  };
}

export function toKeywordStat(a: KeywordAgg): KeywordStat {
  const cur = periodStat(a.clicks, a.impressions, a.posWeighted, a.posWeight);
  const prev = a.prevImpressions > 0 || a.prevClicks > 0 ? periodStat(a.prevClicks, a.prevImpressions, a.prevPosWeighted, a.prevPosWeight) : null;
  return {
    query: a.key,
    ...cur,
    previous: prev,
    clicksChange: cur.clicks - (prev?.clicks ?? 0),
    positionChange: cur.position != null && prev?.position != null ? round1(cur.position - prev.position) : null,
  };
}

/** Stats for every query seen in the current period (queries only seen before are dropped from the list). */
export function buildKeywordStats(aggs: KeywordAgg[]): KeywordStat[] {
  return aggs.filter((a) => a.impressions > 0 || a.clicks > 0).map(toKeywordStat);
}

// ---- list: search, sort, paginate ---------------------------------------------------------------------------------

export const SORT_KEYS = ["clicks", "impressions", "ctr", "position", "clicksChange", "positionChange", "query"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface ListOptions {
  search?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** Only these queries (e.g. starred). */
  only?: Set<string>;
}

export function filterKeywords(stats: KeywordStat[], o: Pick<ListOptions, "search" | "only">): KeywordStat[] {
  const s = o.search?.trim().toLowerCase();
  return stats.filter((k) => (!s || k.query.toLowerCase().includes(s)) && (!o.only || o.only.has(k.query)));
}

/** Sort with nulls always last, ties broken by impressions then query text (stable, deterministic). */
export function sortKeywords(stats: KeywordStat[], sort: SortKey = "clicks", dir: "asc" | "desc" = "desc"): KeywordStat[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...stats].sort((a, b) => {
    if (sort === "query") return sign * a.query.localeCompare(b.query);
    const av = a[sort];
    const bv = b[sort];
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    if (av != null && bv != null && av !== bv) return sign * (av - bv);
    return b.impressions - a.impressions || a.query.localeCompare(b.query);
  });
}

export function listKeywords(stats: KeywordStat[], o: ListOptions = {}) {
  const filtered = sortKeywords(filterKeywords(stats, o), o.sort, o.dir);
  const pageSize = Math.min(Math.max(o.pageSize ?? 50, 1), 500);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(o.page ?? 1, 1), pages);
  return { total: filtered.length, page, pages, pageSize, items: filtered.slice((page - 1) * pageSize, page * pageSize) };
}

// ---- opportunities -------------------------------------------------------------------------------------------------

/**
 * Rough organic click-through rate by average position (blended public industry studies, desktop + mobile). Only used
 * to spot titles that get far FEWER clicks than usual for their position — it is a yardstick, not a promise.
 */
const CTR_CURVE = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];

export function expectedCtr(position: number): number {
  if (!Number.isFinite(position) || position < 1) return CTR_CURVE[0];
  if (position >= CTR_CURVE.length) return position <= 20 ? 0.01 : 0.005;
  const i = Math.floor(position) - 1;
  const frac = position - Math.floor(position);
  return CTR_CURVE[i] + (CTR_CURVE[i + 1] - CTR_CURVE[i]) * frac;
}

export type OpportunityKind = "almost_page_1" | "low_ctr" | "losing_ground" | "new_keyword";

export interface Opportunity {
  kind: OpportunityKind;
  query: string;
  stat: KeywordStat;
  /** Why it was flagged, in plain English. */
  why: string;
  /** What to do next, in plain English. */
  nextStep: string;
  link?: { href: string; label: string };
}

export const OPPORTUNITY_INFO: Record<OpportunityKind, { title: string; blurb: string }> = {
  almost_page_1: {
    title: "Almost on page 1",
    blurb: "Searches where you sit just below the top results. A small push can move you onto page 1, where most clicks happen.",
  },
  low_ctr: {
    title: "Seen a lot, clicked little",
    blurb: "You show up high enough, but fewer people click than usual for that position. Usually the title or description needs work.",
  },
  losing_ground: {
    title: "Losing ground",
    blurb: "Searches where you dropped 3 or more places, or got at least 30% fewer clicks than the period before.",
  },
  new_keyword: {
    title: "New this period",
    blurb: "Searches Google started showing you for in this period. Worth checking whether they match what you sell.",
  },
};

/** Minimum volumes scale with the length of the period (thresholds are written for 28 days). */
export function thresholds(days: number) {
  const s = days / 28;
  return {
    almostImpressions: Math.max(10, Math.round(50 * s)),
    lowCtrImpressions: Math.max(20, Math.round(100 * s)),
    losingPrevClicks: Math.max(3, Math.round(5 * s)),
    losingPrevImpressions: Math.max(10, Math.round(30 * s)),
    newImpressions: Math.max(3, Math.round(10 * s)),
  };
}

const fmtPos = (p: number | null | undefined) => (p == null ? "–" : p.toFixed(1));
const fmtPct = (r: number | null | undefined) => (r == null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);

export interface OpportunityOptions {
  days: number;
  /** False when there is no Search Console data at all for the previous period (first weeks after connecting). */
  hasPreviousData: boolean;
  /** Max items per group. */
  limit?: number;
}

export function findOpportunities(stats: KeywordStat[], o: OpportunityOptions): Record<OpportunityKind, Opportunity[]> {
  const t = thresholds(o.days);
  const limit = o.limit ?? 25;
  const out: Record<OpportunityKind, Opportunity[]> = { almost_page_1: [], low_ctr: [], losing_ground: [], new_keyword: [] };

  for (const k of stats) {
    const p = k.position;
    if (p != null && p >= 8 && p <= 20 && k.impressions >= t.almostImpressions) {
      out.almost_page_1.push({
        kind: "almost_page_1",
        query: k.query,
        stat: k,
        why: `Average position ${fmtPos(p)} with ${k.impressions.toLocaleString("en-IN")} impressions.`,
        nextStep:
          p > 10
            ? `You're on page 2. Make sure one page clearly answers "${k.query}": use the phrase in a heading, add a short direct answer near the top, and link to that page from 2–3 related pages on your site.`
            : `You're at the bottom of page 1. Improve the page that ranks: answer "${k.query}" directly near the top, add helpful detail (prices, steps, FAQs) and link to it from related pages.`,
      });
    }
    if (p != null && p <= 10 && k.impressions >= t.lowCtrImpressions && k.ctr != null) {
      const exp = expectedCtr(p);
      if (k.ctr < exp * 0.5) {
        out.low_ctr.push({
          kind: "low_ctr",
          query: k.query,
          stat: k,
          why: `Click rate ${fmtPct(k.ctr)} at position ${fmtPos(p)}; around ${fmtPct(exp)} is typical there.`,
          nextStep: `Rewrite the page title and meta description so they match what someone searching "${k.query}" wants, and give a reason to click (price, location, offer, "updated 2026").`,
          link: { href: "/tools/seo-title-generator", label: "Write a better title" },
        });
      }
    }
    const prev = k.previous;
    if (prev) {
      const dropped = k.positionChange != null && k.positionChange >= 3 && prev.impressions >= t.losingPrevImpressions;
      const fewerClicks = prev.clicks >= t.losingPrevClicks && k.clicks <= prev.clicks * 0.7;
      if (dropped || fewerClicks) {
        const parts: string[] = [];
        if (dropped) parts.push(`position went from ${fmtPos(prev.position)} to ${fmtPos(k.position)}`);
        if (fewerClicks) parts.push(`clicks fell from ${prev.clicks} to ${k.clicks}`);
        out.losing_ground.push({
          kind: "losing_ground",
          query: k.query,
          stat: k,
          why: `${parts.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
          nextStep: `Search "${k.query}" yourself and look at who now ranks above you. Update your page with anything they cover that you don't, refresh old facts and dates, and check the page still loads and isn't blocked.`,
        });
      }
    } else if (o.hasPreviousData && k.impressions >= t.newImpressions) {
      out.new_keyword.push({
        kind: "new_keyword",
        query: k.query,
        stat: k,
        why: `${k.impressions.toLocaleString("en-IN")} impressions this period, none in the period before.`,
        nextStep:
          p != null && p <= 10
            ? `Google already likes you for "${k.query}". If it matches what you sell, keep that page fresh and link to it from your home page.`
            : `If "${k.query}" matches what you sell, give it a clear section (or its own page) so Google has something focused to rank.`,
      });
    }
  }

  out.almost_page_1.sort((a, b) => b.stat.impressions - a.stat.impressions);
  out.low_ctr.sort((a, b) => b.stat.impressions - a.stat.impressions);
  out.losing_ground.sort(
    (a, b) => a.stat.clicksChange - b.stat.clicksChange || (b.stat.positionChange ?? 0) - (a.stat.positionChange ?? 0),
  );
  out.new_keyword.sort((a, b) => b.stat.impressions - a.stat.impressions);
  for (const k of Object.keys(out) as OpportunityKind[]) out[k] = out[k].slice(0, limit);
  return out;
}

// ---- history -------------------------------------------------------------------------------------------------------

export interface DailyKeywordRow {
  date: string;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
}

export interface HistoryPoint {
  /** Day (YYYY-MM-DD) or the Monday that starts the week. */
  date: string;
  clicks: number;
  impressions: number;
  /** Impression-weighted average position; null when the query didn't appear. */
  position: number | null;
}

/** Monday (UTC) of the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10);
}

/** Daily (gaps filled with zero clicks / no position) or weekly series for one query over [from, to]. */
export function buildHistory(rows: DailyKeywordRow[], from: string, to: string, granularity: "day" | "week" = "day"): HistoryPoint[] {
  const byDate = new Map<string, DailyKeywordRow[]>();
  for (const r of rows) if (r.date >= from && r.date <= to) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const buckets = new Map<string, { clicks: number; impressions: number; w: number; wSum: number }>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = granularity === "week" ? weekStart(d) : d;
    const b = buckets.get(key) ?? { clicks: 0, impressions: 0, w: 0, wSum: 0 };
    for (const r of byDate.get(d) ?? []) {
      b.clicks += r.clicks ?? 0;
      b.impressions += r.impressions ?? 0;
      if (r.position != null && (r.impressions ?? 0) > 0) {
        b.w += r.impressions ?? 0;
        b.wSum += r.position * (r.impressions ?? 0);
      }
    }
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, clicks: b.clicks, impressions: b.impressions, position: b.w > 0 ? round1(b.wSum / b.w) : null }));
}

// ---- group by page -------------------------------------------------------------------------------------------------

export interface QueryPageRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number | null;
}

export interface PageGroup {
  page: string;
  clicks: number;
  impressions: number;
  queries: { query: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[];
}

/** Which page ranks for what: pages by clicks, each with its queries by clicks (at most `perPage`). */
export function groupByPage(rows: QueryPageRow[], perPage = 50): PageGroup[] {
  const m = new Map<string, PageGroup>();
  for (const r of rows) {
    const g = m.get(r.page) ?? { page: r.page, clicks: 0, impressions: 0, queries: [] };
    g.clicks += r.clicks;
    g.impressions += r.impressions;
    g.queries.push({
      query: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : null,
      position: r.position != null ? round1(r.position) : null,
    });
    m.set(r.page, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, queries: g.queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, perPage) }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}
