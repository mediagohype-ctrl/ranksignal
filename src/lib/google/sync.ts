// Daily sync of Search Console + GA4 metrics into MetricDaily.
// - Due: connected integrations with a chosen property, not synced in the last 20h (failures back off 6h).
// - Window: the last 3 finished UTC days (re-fetched daily because GSC data lags ~2-3 days); 90 days on first sync.
// - Writes replace the source's rows inside the window in one transaction (idempotent; no duplicates).
// - Quota/401 errors mark the integration "degraded" and notify the org once until a sync succeeds again.
import type { Integration, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { isGoogleConfigured } from "./config";
import { ga4RunReport, gscQuery, type Ga4Report, type GscRow } from "./api";
import { GoogleApiError } from "./http";
import { accessTokenFor, readGoogleConfig, selectedTarget, toJson, type GoogleIntegrationConfig } from "./integration";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const SYNC_INTERVAL_MS = 20 * HOUR;
export const FAILURE_BACKOFF_MS = 6 * HOUR;
export const RECENT_DAYS = 3;
export const BACKFILL_DAYS = 90;
export const TOP_N = 250;
const MAX_PER_TICK = 10;
const MAX_KEY = 1000;
const GSC_PAGE = 25_000;
const GSC_MAX_PAGES = 4;
const INSERT_CHUNK = 2000;

/** AI assistants we can recognise as referrers in GA4 (sessionSource). */
export const AI_REFERRERS: { host: string; label: string }[] = [
  { host: "chatgpt.com", label: "ChatGPT" },
  { host: "perplexity.ai", label: "Perplexity" },
  { host: "gemini.google.com", label: "Gemini" },
  { host: "copilot.microsoft.com", label: "Copilot" },
  { host: "claude.ai", label: "Claude" },
];
const AI_SOURCE_REGEX = `(.*\\.)?(${AI_REFERRERS.map((a) => a.host.replace(/\./g, "\\.")).join("|")})`;

export function aiReferrerKey(source: string): string | null {
  const s = source.trim().toLowerCase();
  for (const a of AI_REFERRERS) if (s === a.host || s.endsWith(`.${a.host}`)) return a.host;
  return null;
}

export interface MetricRow {
  date: string;
  dimension: "total" | "query" | "page" | "channel" | "ai_referrer";
  key: string;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
  sessions?: number | null;
  conversions?: number | null;
}

// ---- dates ---------------------------------------------------------------------------------------------------------

export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => ymd(new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY));

export function syncWindow(now: Date, backfilled: boolean): { startDate: string; endDate: string } {
  const endDate = ymd(new Date(now.getTime() - DAY));
  return { endDate, startDate: addDays(endDate, -((backfilled ? RECENT_DAYS : BACKFILL_DAYS) - 1)) };
}

const ga4Date = (v: string | undefined) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
const int = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};
const float = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ---- transforms (pure; exported for tests) -------------------------------------------------------------------------

/** Keep the top `n` rows per date by clicks, then impressions. */
export function topPerDate(rows: MetricRow[], n = TOP_N): MetricRow[] {
  const byDate = new Map<string, MetricRow[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const out: MetricRow[] = [];
  for (const list of byDate.values()) {
    list.sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0) || (b.impressions ?? 0) - (a.impressions ?? 0));
    out.push(...list.slice(0, n));
  }
  return out;
}

export function gscRowsToMetrics(rows: GscRow[], dimension: MetricRow["dimension"]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const r of rows) {
    const date = r.keys?.[0];
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      dimension,
      key: dimension === "total" ? "" : (r.keys?.[1] ?? "").slice(0, MAX_KEY),
      clicks: int(r.clicks),
      impressions: int(r.impressions),
      ctr: float(r.ctr),
      position: float(r.position),
    });
  }
  return out;
}

export function ga4ReportToMetrics(rep: Ga4Report, dimension: MetricRow["dimension"]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const r of rep.rows ?? []) {
    const date = ga4Date(r.dimensionValues?.[0]?.value);
    if (!date) continue;
    let key = "";
    if (dimension === "channel") key = (r.dimensionValues?.[1]?.value ?? "(not set)").slice(0, MAX_KEY);
    if (dimension === "ai_referrer") {
      const k = aiReferrerKey(r.dimensionValues?.[1]?.value ?? "");
      if (!k) continue;
      key = k;
    }
    out.push({ date, dimension, key, sessions: int(r.metricValues?.[0]?.value), conversions: int(r.metricValues?.[1]?.value) });
  }
  return out;
}

/** Collapse rows with the same (date, dimension, key): counts are summed, rates keep the last value. */
export function dedupeRows(rows: MetricRow[]): MetricRow[] {
  const m = new Map<string, MetricRow>();
  const add = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
  for (const r of rows) {
    const k = `${r.date}\u0000${r.dimension}\u0000${r.key}`;
    const cur = m.get(k);
    if (!cur) {
      m.set(k, { ...r });
      continue;
    }
    cur.clicks = add(cur.clicks, r.clicks);
    cur.impressions = add(cur.impressions, r.impressions);
    cur.sessions = add(cur.sessions, r.sessions);
    cur.conversions = add(cur.conversions, r.conversions);
    cur.ctr = r.ctr ?? cur.ctr;
    cur.position = r.position ?? cur.position;
  }
  return [...m.values()];
}

// ---- fetchers ------------------------------------------------------------------------------------------------------

async function gscAll(token: string, siteUrl: string, w: { startDate: string; endDate: string }, dims: string[]): Promise<GscRow[]> {
  const out: GscRow[] = [];
  for (let p = 0; p < GSC_MAX_PAGES; p++) {
    const rows = await gscQuery(token, siteUrl, { ...w, dimensions: dims, rowLimit: GSC_PAGE, startRow: p * GSC_PAGE, dataState: "all" });
    out.push(...rows);
    if (rows.length < GSC_PAGE) break;
  }
  return out;
}

export async function fetchGscMetrics(token: string, siteUrl: string, w: { startDate: string; endDate: string }): Promise<MetricRow[]> {
  const totals = await gscQuery(token, siteUrl, { ...w, dimensions: ["date"], rowLimit: GSC_PAGE, dataState: "all" });
  const queries = await gscAll(token, siteUrl, w, ["date", "query"]);
  const pages = await gscAll(token, siteUrl, w, ["date", "page"]);
  return [
    ...gscRowsToMetrics(totals, "total"),
    ...topPerDate(gscRowsToMetrics(queries, "query")),
    ...topPerDate(gscRowsToMetrics(pages, "page")),
  ];
}

export async function fetchGa4Metrics(token: string, propertyId: string, w: { startDate: string; endDate: string }): Promise<MetricRow[]> {
  const run = async (dims: string[], conversionMetric: "keyEvents" | "conversions", filter?: Record<string, unknown>) =>
    ga4RunReport(token, propertyId, {
      dateRanges: [w],
      dimensions: dims.map((name) => ({ name })),
      metrics: [{ name: "sessions" }, { name: conversionMetric }],
      limit: 100000,
      ...(filter ? { dimensionFilter: filter } : {}),
    });
  // "keyEvents" replaced "conversions" in 2024; fall back for properties/APIs that still only accept the old name.
  let metric: "keyEvents" | "conversions" = "keyEvents";
  let total: Ga4Report;
  try {
    total = await run(["date"], metric);
  } catch (e) {
    if (!(e instanceof GoogleApiError && e.kind === "bad_request")) throw e;
    metric = "conversions";
    total = await run(["date"], metric);
  }
  const channels = await run(["date", "sessionDefaultChannelGroup"], metric);
  const ai = await run(["date", "sessionSource"], metric, {
    filter: { fieldName: "sessionSource", stringFilter: { matchType: "FULL_REGEXP", value: AI_SOURCE_REGEX, caseSensitive: false } },
  });
  return [...ga4ReportToMetrics(total, "total"), ...ga4ReportToMetrics(channels, "channel"), ...ga4ReportToMetrics(ai, "ai_referrer")];
}

// ---- persistence ---------------------------------------------------------------------------------------------------

/** Replace the source's rows in [startDate, endDate] with `rows` (one transaction → idempotent, no duplicates). */
export async function writeMetricRows(o: {
  organizationId: string;
  projectId: string;
  source: "gsc" | "ga4";
  startDate: string;
  endDate: string;
  rows: MetricRow[];
}): Promise<number> {
  const data: Prisma.MetricDailyCreateManyInput[] = dedupeRows(o.rows)
    .filter((r) => r.date >= o.startDate && r.date <= o.endDate)
    .map((r) => ({
      organizationId: o.organizationId,
      projectId: o.projectId,
      source: o.source,
      date: r.date,
      dimension: r.dimension,
      key: r.key,
      clicks: r.clicks ?? null,
      impressions: r.impressions ?? null,
      ctr: r.ctr ?? null,
      position: r.position ?? null,
      sessions: r.sessions ?? null,
      conversions: r.conversions ?? null,
    }));
  const ops: Prisma.PrismaPromise<unknown>[] = [
    db.metricDaily.deleteMany({ where: { projectId: o.projectId, source: o.source, date: { gte: o.startDate, lte: o.endDate } } }),
  ];
  for (let i = 0; i < data.length; i += INSERT_CHUNK) {
    ops.push(db.metricDaily.createMany({ data: data.slice(i, i + INSERT_CHUNK), skipDuplicates: true }));
  }
  await db.$transaction(ops);
  return data.length;
}

// ---- one integration -----------------------------------------------------------------------------------------------

const inflight = new Set<string>();

function failureMessage(e: unknown): { kind: string; message: string } {
  if (e instanceof GoogleApiError) {
    if (e.kind === "auth") return { kind: e.kind, message: "Google access was revoked or expired. Reconnect to keep data flowing." };
    if (e.kind === "quota") return { kind: e.kind, message: "Google's daily API limit was reached. We'll try again later." };
    if (e.kind === "permission") return { kind: e.kind, message: "The connected Google account no longer has access to this property." };
    if (e.kind === "unavailable") return { kind: e.kind, message: "Google didn't respond. We'll try again later." };
    return { kind: e.kind, message: `Google returned an error: ${e.message}`.slice(0, 300) };
  }
  return { kind: "error", message: "Sync failed unexpectedly. We'll try again later." };
}

export type SyncResult = { status: "synced"; rows: number } | { status: "skipped"; reason: string } | { status: "failed"; kind: string };

export async function syncGoogleIntegration(row: Integration, now = new Date()): Promise<SyncResult> {
  if (row.provider !== "gsc" && row.provider !== "ga4") return { status: "skipped", reason: "not_google" };
  if (!row.projectId || !row.credentialEncrypted) return { status: "skipped", reason: "not_connected" };
  const cfg = readGoogleConfig(row.config);
  const target = selectedTarget(row.provider, cfg);
  if (!target) return { status: "skipped", reason: "no_property" };
  if (inflight.has(row.id)) return { status: "skipped", reason: "in_progress" };
  inflight.add(row.id);
  const source = row.provider;
  try {
    const w = syncWindow(now, Boolean(cfg.sync?.backfilledAt));
    const token = await accessTokenFor(row); // refreshed every run; never stored
    const rows = source === "gsc" ? await fetchGscMetrics(token, target, w) : await fetchGa4Metrics(token, target, w);
    const written = await writeMetricRows({ organizationId: row.organizationId, projectId: row.projectId, source, ...w, rows });
    const next: GoogleIntegrationConfig = {
      ...cfg,
      sync: { backfilledAt: cfg.sync?.backfilledAt ?? now.toISOString(), lastAttemptAt: now.toISOString(), lastError: null, notifiedAt: null },
    };
    await db.integration.update({ where: { id: row.id }, data: { lastSyncAt: now, health: "healthy", config: toJson(next) } });
    log.info("google.sync.ok", { integrationId: row.id, source, rows: written, from: w.startDate, to: w.endDate });
    return { status: "synced", rows: written };
  } catch (e) {
    const f = failureMessage(e);
    log.warn("google.sync.failed", { integrationId: row.id, source, kind: f.kind, status: e instanceof GoogleApiError ? e.status : undefined });
    const shouldNotify = !cfg.sync?.notifiedAt;
    const next: GoogleIntegrationConfig = {
      ...cfg,
      sync: {
        ...cfg.sync,
        lastAttemptAt: now.toISOString(),
        lastError: f.message,
        notifiedAt: shouldNotify ? now.toISOString() : cfg.sync?.notifiedAt ?? null,
      },
    };
    try {
      await db.integration.update({ where: { id: row.id }, data: { health: "degraded", config: toJson(next) } });
      if (shouldNotify) {
        await db.notification.create({
          data: {
            organizationId: row.organizationId,
            type: "integration_degraded",
            title: `${source === "gsc" ? "Search Console" : "Google Analytics"} data paused`,
            body: f.message,
            link: `/app/projects/${row.projectId}/integrations`,
          },
        });
      }
    } catch (inner) {
      log.error("google.sync.record_failure_failed", { integrationId: row.id, err: inner });
    }
    return { status: "failed", kind: f.kind };
  } finally {
    inflight.delete(row.id);
  }
}

export async function syncGoogleIntegrationById(id: string, organizationId: string): Promise<SyncResult> {
  const row = await db.integration.findFirst({ where: { id, organizationId } });
  if (!row) return { status: "skipped", reason: "not_found" };
  return syncGoogleIntegration(row);
}

// ---- scheduler entry -----------------------------------------------------------------------------------------------

let ticking = false;

/** Called from the scheduler tick. Never throws. */
export async function syncGoogleMetricsDue(now = new Date()): Promise<{ synced: number; failed: number; skipped: number }> {
  const summary = { synced: 0, failed: 0, skipped: 0 };
  if (!isGoogleConfigured() || ticking) return summary;
  ticking = true;
  try {
    const cutoff = new Date(now.getTime() - SYNC_INTERVAL_MS);
    const rows = await db.integration.findMany({
      where: {
        provider: { in: ["gsc", "ga4"] },
        credentialEncrypted: { not: null },
        projectId: { not: null },
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoff } }],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    let attempted = 0;
    for (const row of rows) {
      if (attempted >= MAX_PER_TICK) break;
      const cfg = readGoogleConfig(row.config);
      if (!selectedTarget(row.provider, cfg)) continue;
      const last = cfg.sync?.lastAttemptAt ? Date.parse(cfg.sync.lastAttemptAt) : 0;
      if (cfg.sync?.lastError && now.getTime() - last < FAILURE_BACKOFF_MS) continue;
      attempted++;
      const r = await syncGoogleIntegration(row, now);
      summary[r.status === "synced" ? "synced" : r.status === "failed" ? "failed" : "skipped"]++;
    }
  } catch (e) {
    log.error("google.sync.tick_failed", { err: e });
  } finally {
    ticking = false;
  }
  return summary;
}
