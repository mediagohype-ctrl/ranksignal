// Collects the facts a built client report shows, for one project and date range. Read-only; every query is
// scoped by organizationId + projectId. Real stored data only — sections without data are reported as empty and
// skipped by the view, never filled with placeholders.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { getStoredReport } from "@/lib/report/stored";
import type { SiteReport } from "@/lib/report/types";
import { toPublicReport } from "@/lib/share/public-report";
import { getSnapshotAt, listSnapshots, type SnapshotView } from "@/lib/snapshots";
import { listShippedWork } from "@/lib/tasks";
import { getSearchSummary, type SearchSummary } from "@/lib/google/summary";
import type { ResolvedRange } from "./sections";

export interface ScorePoint {
  at: string;
  overall: number | null;
  seo: number | null;
  aeo: number | null;
  geo: number | null;
  brand: number | null;
}

export interface VitalsRow {
  url: string;
  strategy: string;
  isHome: boolean;
  performanceScore: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  source: "field" | "lab";
  fetchedAt: string | null;
}

export interface BuilderReportData {
  project: { id: string; name: string; websiteUrl: string };
  range: { firstDay: string; lastDay: string; label: string };
  generatedAt: string;
  report: SiteReport | null;
  scores: { start: ScorePoint | null; end: ScorePoint | null };
  history: ScorePoint[];
  fixes: {
    shipped: { title: string; category: string; performedBy: string; completedAt: string; url?: string }[];
    resolved: { total: number; top: { message: string; severity: string; count: number }[] };
  };
  search: NonNullable<SearchSummary["gsc"]> | null;
  vitals: VitalsRow[] | null;
}

const point = (s: SnapshotView): ScorePoint => ({
  at: s.createdAt.toISOString(),
  overall: s.overallScore,
  seo: s.pillarScores.seo,
  aeo: s.pillarScores.aeo,
  geo: s.pillarScores.geo,
  brand: s.pillarScores.brand,
});

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    log.warn("report_builder.section_failed", { section: label, err: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

async function resolvedProblems(organizationId: string, projectId: string, r: ResolvedRange) {
  const rows = await db.auditFinding.findMany({
    where: { organizationId, projectId, status: "resolved", resolvedAt: { gte: r.from, lt: r.to } },
    select: { code: true, message: true, severity: true },
    take: 5000,
  });
  const byCode = new Map<string, { message: string; severity: string; count: number }>();
  for (const f of rows) {
    const cur = byCode.get(f.code);
    if (cur) cur.count++;
    else byCode.set(f.code, { message: f.message, severity: f.severity, count: 1 });
  }
  const top = [...byCode.values()]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || b.count - a.count)
    .slice(0, 10);
  return { total: rows.length, top };
}

interface PsiRow {
  crawlRunId: string;
  url: string;
  strategy: string;
  isHome: boolean;
  performanceScore: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  fieldLcpMs: number | null;
  fieldInpMs: number | null;
  fieldCls: number | null;
  fetchedAt: Date | null;
}

/** Latest PageSpeed results (if the audit-depth feature stored any). Raw SQL so a missing table just means "none". */
async function vitals(organizationId: string, projectId: string, r: ResolvedRange): Promise<VitalsRow[] | null> {
  try {
    const rows = await db.$queryRaw<PsiRow[]>(Prisma.sql`
      SELECT "crawlRunId", "url", "strategy", "isHome", "performanceScore", "labLcpMs", "labCls", "fieldLcpMs", "fieldInpMs", "fieldCls", "fetchedAt"
        FROM "public"."PageSpeedResult"
       WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId} AND "createdAt" < ${r.to}
         AND ("performanceScore" IS NOT NULL OR "fieldLcpMs" IS NOT NULL OR "labLcpMs" IS NOT NULL)
       ORDER BY "createdAt" DESC
       LIMIT 40`);
    if (!rows.length) return null;
    const latest = rows[0]!.crawlRunId;
    return rows
      .filter((x) => x.crawlRunId === latest)
      .sort((a, b) => Number(b.isHome) - Number(a.isHome) || a.url.localeCompare(b.url))
      .slice(0, 10)
      .map((x) => {
        const field = x.fieldLcpMs !== null || x.fieldInpMs !== null || x.fieldCls !== null;
        return {
          url: x.url,
          strategy: x.strategy,
          isHome: x.isHome,
          performanceScore: x.performanceScore,
          lcpMs: field ? x.fieldLcpMs : x.labLcpMs,
          inpMs: field ? x.fieldInpMs : null,
          cls: field ? x.fieldCls : x.labCls,
          source: field ? "field" : "lab",
          fetchedAt: x.fetchedAt ? new Date(x.fetchedAt).toISOString() : null,
        };
      });
  } catch {
    return null; // PageSpeed data not available on this deployment
  }
}

export async function loadBuilderReport(o: {
  organizationId: string;
  project: { id: string; name: string; websiteUrl: string };
  range: ResolvedRange;
  /** Public share view: strip internal details exactly like the shared report page. */
  publicView?: boolean;
  now?: Date;
}): Promise<BuilderReportData> {
  const { organizationId, project, range } = o;
  const lastMoment = new Date(range.to.getTime() - 1);
  const [report, baseline, end, history, shipped, resolved, search, cwv] = await Promise.all([
    safe("report", () => getStoredReport(project.id, organizationId), null),
    safe("scores_start", () => getSnapshotAt(project.id, organizationId, range.from), null),
    safe("scores_end", () => getSnapshotAt(project.id, organizationId, lastMoment), null),
    safe("history", () => listSnapshots(project.id, organizationId, { from: range.from, to: lastMoment }), [] as SnapshotView[]),
    safe("shipped", () => listShippedWork(project.id, organizationId, range.from, range.to, { clientVisibleOnly: true }), []),
    safe("resolved", () => resolvedProblems(organizationId, project.id, range), { total: 0, top: [] }),
    safe("search", () => getSearchSummary(project.id, organizationId, range.firstDay, range.lastDay), null),
    vitals(organizationId, project.id, range),
  ]);
  // If nothing was measured before the range started, the first check inside it is the baseline.
  const firstInRange = history.find((h) => h.overallScore !== null) ?? null;
  const start = baseline ?? firstInRange;
  return {
    project,
    range: { firstDay: range.firstDay, lastDay: range.lastDay, label: range.label },
    generatedAt: (o.now ?? new Date()).toISOString(),
    report: report && o.publicView ? toPublicReport(report) : report,
    scores: { start: start ? point(start) : null, end: end ? point(end) : null },
    history: history.filter((h) => h.overallScore !== null).map(point),
    fixes: {
      shipped: shipped.slice(0, 50).map((s) => ({
        title: s.title, category: s.category, performedBy: s.performedBy, completedAt: s.completedAt.toISOString(), ...(s.url ? { url: s.url } : {}),
      })),
      resolved,
    },
    search: search?.gsc && search.gsc.hasData ? search.gsc : null,
    vitals: cwv,
  };
}
