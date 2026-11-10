// Portfolio loader: every website in the organisation in a fixed number of batched, org-scoped queries
// (no per-project queries). Scores come from stored ReportSnapshot rows (never the large report JSON).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACTIVE_RUN_STATUSES } from "@/lib/dashboard/format";
import { previousPeriod } from "@/lib/monthly-report/period";
import { buildPortfolioRows, shouldSuggestPortfolio, type PortfolioRow, type PortfolioSnapshotRow } from "@/lib/portfolio/build";

const DONE = ["succeeded", "succeeded_with_warnings"];
export const PORTFOLIO_MAX_PROJECTS = 500;
/** Ignore runs stuck "active" for longer than this when showing "checking now". */
const ACTIVE_WINDOW_MS = 24 * 3600_000;

export interface PortfolioData {
  rows: PortfolioRow[];
  monthlyPeriod: string;
  truncated: boolean;
}

/**
 * Per project: the newest snapshot of any kind, the newest 3 website-check snapshots (for "change since the
 * previous check") and the newest real AI-check snapshot. One query, ranked in Postgres.
 */
async function loadSnapshots(organizationId: string, projectIds: string[]): Promise<PortfolioSnapshotRow[]> {
  if (!projectIds.length) return [];
  const rows = await db.$queryRaw<PortfolioSnapshotRow[]>(Prisma.sql`
    SELECT "projectId", kind, "crawlRunId", "overallScore", grade, "pillarScores", "openIssues", visibility, simulated, "createdAt"
    FROM (
      SELECT "projectId", kind, "crawlRunId", "overallScore", grade, "pillarScores", "openIssues", visibility, simulated, "createdAt",
             ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" DESC, id DESC) AS rn_all,
             ROW_NUMBER() OVER (PARTITION BY "projectId", kind ORDER BY "createdAt" DESC, id DESC) AS rn_kind,
             ROW_NUMBER() OVER (PARTITION BY "projectId", kind, simulated ORDER BY "createdAt" DESC, id DESC) AS rn_real
      FROM "ReportSnapshot"
      WHERE "organizationId" = ${organizationId} AND "projectId" IN (${Prisma.join(projectIds)})
    ) ranked
    WHERE rn_all = 1
       OR (kind = 'crawl' AND rn_kind <= 3)
       OR (kind = 'visibility' AND simulated = false AND rn_real = 1)
  `);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

export async function loadPortfolio(organizationId: string, now: Date = new Date()): Promise<PortfolioData> {
  const projects = await db.project.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, websiteUrl: true, createdAt: true },
    take: PORTFOLIO_MAX_PROJECTS + 1,
  });
  const truncated = projects.length > PORTFOLIO_MAX_PROJECTS;
  const list = projects.slice(0, PORTFOLIO_MAX_PROJECTS);
  const ids = list.map((p) => p.id);
  const monthlyPeriod = previousPeriod(now);
  if (!ids.length) return { rows: [], monthlyPeriod, truncated: false };

  const scope = { organizationId, projectId: { in: ids } };
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  const [snapshots, crawlMax, visMax, activeCrawls, activeVis, monthly] = await Promise.all([
    loadSnapshots(organizationId, ids),
    db.crawlRun.groupBy({ by: ["projectId"], where: { ...scope, status: { in: DONE } }, _max: { finishedAt: true } }),
    db.visibilityRun.groupBy({ by: ["projectId"], where: { ...scope, status: { in: DONE } }, _max: { finishedAt: true } }),
    db.crawlRun.findMany({
      where: { ...scope, status: { in: ACTIVE_RUN_STATUSES }, createdAt: { gte: activeSince } },
      select: { projectId: true },
      take: 1000,
    }),
    db.visibilityRun.findMany({
      where: { ...scope, status: { in: ACTIVE_RUN_STATUSES }, createdAt: { gte: activeSince } },
      select: { projectId: true },
      take: 1000,
    }),
    db.monthlyReport.findMany({ where: { ...scope, period: monthlyPeriod }, select: { projectId: true, status: true } }),
  ]);

  const rows = buildPortfolioRows({
    projects: list,
    snapshots,
    lastCrawlAt: new Map(crawlMax.map((g) => [g.projectId, g._max.finishedAt])),
    lastAiCheckAt: new Map(visMax.map((g) => [g.projectId, g._max.finishedAt])),
    activeCrawls: new Set(activeCrawls.map((r) => r.projectId)),
    activeAiChecks: new Set(activeVis.map((r) => r.projectId)),
    monthly: new Map(monthly.map((m) => [m.projectId, m.status])),
  });
  return { rows, monthlyPeriod, truncated };
}

/** For navigation: true when the organisation has 2+ websites (make the portfolio the landing suggestion). */
export async function suggestPortfolioForOrg(organizationId: string): Promise<boolean> {
  const n = await db.project.count({ where: { organizationId } });
  return shouldSuggestPortfolio(n);
}
