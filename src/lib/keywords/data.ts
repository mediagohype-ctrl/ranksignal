// Server-side data for the Keywords page: Search Console query rows already stored by the daily sync (MetricDaily,
// dimension "query"), stars, and a live query+page breakdown. Every query is scoped by organizationId + projectId.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { gscQuery } from "@/lib/google/api";
import { accessTokenFor, findGoogleIntegration, readGoogleConfig } from "@/lib/google/integration";
import { QUERY_TOP_N } from "@/lib/google/sync";
import {
  addDays, buildHistory, buildKeywordStats, groupByPage, periodsFor, type HistoryPoint, type KeywordAgg, type KeywordStat, type PageGroup,
  type Periods, type QueryPageRow,
} from "./analyze";
import { MAX_QUERY_LENGTH, keywordStarLimit } from "./limits";

export interface GscKeywordStatus {
  connected: boolean;
  siteUrl: string | null;
  needsSelection: boolean;
  health: string;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Newest date with stored query rows (Search Console lags 2–3 days). */
  lastDataDate: string | null;
  /** How many queries per day the sync keeps. */
  queriesPerDayCap: number;
}

export async function gscKeywordStatus(organizationId: string, projectId: string): Promise<GscKeywordStatus> {
  const [row, latest] = await Promise.all([
    findGoogleIntegration(organizationId, projectId, "gsc"),
    db.metricDaily.findFirst({
      where: { organizationId, projectId, source: "gsc", dimension: "query" },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);
  const cfg = readGoogleConfig(row?.config);
  const connected = Boolean(row?.credentialEncrypted);
  return {
    connected,
    siteUrl: cfg.siteUrl ?? null,
    needsSelection: connected && !cfg.siteUrl,
    health: row?.health ?? "unknown",
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    lastError: cfg.sync?.lastError ?? null,
    lastDataDate: latest?.date ?? null,
    queriesPerDayCap: QUERY_TOP_N,
  };
}

interface RawAgg {
  key: string;
  clicks: number;
  impressions: number;
  posWeighted: number;
  posWeight: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosWeighted: number;
  prevPosWeight: number;
}

/** One SQL pass: per-query sums for the current and previous periods (impression-weighted position). */
async function aggregateQueries(organizationId: string, projectId: string, p: Periods): Promise<KeywordAgg[]> {
  const rows = await db.$queryRaw<RawAgg[]>(Prisma.sql`
    SELECT "key",
      COALESCE(SUM("clicks") FILTER (WHERE "date" >= ${p.from}), 0)::float8 AS "clicks",
      COALESCE(SUM("impressions") FILTER (WHERE "date" >= ${p.from}), 0)::float8 AS "impressions",
      COALESCE(SUM("position" * "impressions") FILTER (WHERE "date" >= ${p.from} AND "position" IS NOT NULL), 0)::float8 AS "posWeighted",
      COALESCE(SUM("impressions") FILTER (WHERE "date" >= ${p.from} AND "position" IS NOT NULL), 0)::float8 AS "posWeight",
      COALESCE(SUM("clicks") FILTER (WHERE "date" <= ${p.previousTo}), 0)::float8 AS "prevClicks",
      COALESCE(SUM("impressions") FILTER (WHERE "date" <= ${p.previousTo}), 0)::float8 AS "prevImpressions",
      COALESCE(SUM("position" * "impressions") FILTER (WHERE "date" <= ${p.previousTo} AND "position" IS NOT NULL), 0)::float8 AS "prevPosWeighted",
      COALESCE(SUM("impressions") FILTER (WHERE "date" <= ${p.previousTo} AND "position" IS NOT NULL), 0)::float8 AS "prevPosWeight"
    FROM "MetricDaily"
    WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      AND "source" = 'gsc' AND "dimension" = 'query'
      AND "date" >= ${p.previousFrom} AND "date" <= ${p.to}
    GROUP BY "key"
  `);
  return rows.map((r) => ({
    key: r.key,
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
    posWeighted: Number(r.posWeighted),
    posWeight: Number(r.posWeight),
    prevClicks: Number(r.prevClicks),
    prevImpressions: Number(r.prevImpressions),
    prevPosWeighted: Number(r.prevPosWeighted),
    prevPosWeight: Number(r.prevPosWeight),
  }));
}

export interface KeywordDataset {
  periods: Periods;
  stats: KeywordStat[];
  hasPreviousData: boolean;
  /** Site totals (all searches, incl. the rare ones Google keeps private) vs the clicks our query rows explain. */
  totals: { siteClicks: number; siteImpressions: number; queryClicks: number; queryImpressions: number };
}

/** The period ends on the newest day with data (not "yesterday") so short ranges aren't half empty while GSC lags. */
export async function keywordDataset(organizationId: string, projectId: string, days: number, lastDataDate: string | null): Promise<KeywordDataset> {
  const to = lastDataDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const periods = periodsFor(to, days);
  const [aggs, totalRows] = await Promise.all([
    aggregateQueries(organizationId, projectId, periods),
    db.metricDaily.findMany({
      where: { organizationId, projectId, source: "gsc", dimension: "total", date: { gte: periods.previousFrom, lte: periods.to } },
      select: { date: true, clicks: true, impressions: true },
    }),
  ]);
  const stats = buildKeywordStats(aggs);
  const cur = totalRows.filter((r) => r.date >= periods.from);
  return {
    periods,
    stats,
    hasPreviousData: totalRows.some((r) => r.date <= periods.previousTo) || aggs.some((a) => a.prevImpressions > 0),
    totals: {
      siteClicks: cur.reduce((s, r) => s + (r.clicks ?? 0), 0),
      siteImpressions: cur.reduce((s, r) => s + (r.impressions ?? 0), 0),
      queryClicks: stats.reduce((s, k) => s + k.clicks, 0),
      queryImpressions: stats.reduce((s, k) => s + k.impressions, 0),
    },
  };
}

export function cleanQuery(q: unknown): string {
  if (typeof q !== "string") throw new HttpError(400, "invalid_query", "Choose a keyword");
  const s = q.trim();
  if (!s || s.length > MAX_QUERY_LENGTH) throw new HttpError(400, "invalid_query", "Choose a keyword");
  return s;
}

export async function keywordHistory(
  organizationId: string, projectId: string, query: string, days: number, granularity: "day" | "week", lastDataDate: string | null,
): Promise<{ from: string; to: string; points: HistoryPoint[] }> {
  const to = lastDataDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const from = addDays(to, -(days - 1));
  const rows = await db.metricDaily.findMany({
    where: { organizationId, projectId, source: "gsc", dimension: "query", key: query, date: { gte: from, lte: to } },
    select: { date: true, clicks: true, impressions: true, position: true },
    orderBy: { date: "asc" },
  });
  return { from, to, points: buildHistory(rows, from, to, granularity) };
}

// ---- live query x page breakdown (one Search Console API call, cached briefly) ------------------------------------

const PAGE_ROWS_LIMIT = 5000;
const CACHE_MS = 10 * 60_000;
const pageCache = new Map<string, { at: number; groups: PageGroup[]; truncated: boolean }>();

export async function keywordsByPage(organizationId: string, projectId: string, p: Pick<Periods, "from" | "to">) {
  const row = await findGoogleIntegration(organizationId, projectId, "gsc");
  const siteUrl = readGoogleConfig(row?.config).siteUrl;
  if (!row?.credentialEncrypted || !siteUrl) throw new HttpError(409, "gsc_not_connected", "Connect Google Search Console first.");
  const key = `${organizationId}:${projectId}:${siteUrl}:${p.from}:${p.to}`;
  const hit = pageCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { groups: hit.groups, truncated: hit.truncated, cached: true };
  const token = await accessTokenFor(row);
  const rows = await gscQuery(token, siteUrl, { startDate: p.from, endDate: p.to, dimensions: ["query", "page"], rowLimit: PAGE_ROWS_LIMIT, dataState: "all" });
  const mapped: QueryPageRow[] = rows
    .filter((r) => typeof r.keys?.[0] === "string" && typeof r.keys?.[1] === "string")
    .map((r) => ({
      query: r.keys![0].slice(0, MAX_QUERY_LENGTH),
      page: r.keys![1].slice(0, 2000),
      clicks: Math.round(r.clicks ?? 0),
      impressions: Math.round(r.impressions ?? 0),
      position: typeof r.position === "number" ? r.position : null,
    }));
  const groups = groupByPage(mapped);
  const truncated = rows.length >= PAGE_ROWS_LIMIT;
  if (pageCache.size > 500) pageCache.clear();
  pageCache.set(key, { at: Date.now(), groups, truncated });
  return { groups, truncated, cached: false };
}

// ---- stars ---------------------------------------------------------------------------------------------------------

export async function listStars(organizationId: string, projectId: string): Promise<string[]> {
  const rows = await db.keywordStar.findMany({ where: { organizationId, projectId }, orderBy: { createdAt: "asc" }, select: { query: true } });
  return rows.map((r) => r.query);
}

export async function starUsage(organizationId: string) {
  const [org, used] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } }),
    db.keywordStar.count({ where: { organizationId } }),
  ]);
  return { used, limit: keywordStarLimit(org?.planId) };
}

export async function addStar(organizationId: string, projectId: string, query: string, userId: string) {
  const existing = await db.keywordStar.findFirst({ where: { organizationId, projectId, query }, select: { id: true } });
  if (existing) return { created: false };
  const { used, limit } = await starUsage(organizationId);
  if (used >= limit) {
    throw new HttpError(
      403,
      "star_limit",
      `Your plan can track ${limit.toLocaleString("en-IN")} keywords. Un-star one first, or upgrade to track more.`,
    );
  }
  try {
    await db.keywordStar.create({ data: { organizationId, projectId, query, createdById: userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
    throw e;
  }
  return { created: true };
}

export async function removeStar(organizationId: string, projectId: string, query: string) {
  const r = await db.keywordStar.deleteMany({ where: { organizationId, projectId, query } });
  return { removed: r.count > 0 };
}
