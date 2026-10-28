// Server-side aggregation for the project overview (used by the page and GET /api/projects/[id]/dashboard).
import { db } from "@/lib/db";
import type { VisibilityMetrics } from "@/lib/types";
import { appliedChangeWhere } from "@/lib/actions/service";
import { ACTIVE_RUN_STATUSES } from "./format";

const DONE = ["succeeded", "succeeded_with_warnings"];
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

export interface HistoryPoint {
  runId: string;
  at: string;
  visibilityIndex: number;
  mentionRate: number;
  citationRate: number;
  recommendationRate: number;
  sampleSize: number;
  promptSetVersion: number;
  simulated: boolean;
  /** true when the prompt set changed vs the previous point — trend is not directly comparable. */
  discontinuity: boolean;
}

export interface RecentRun {
  id: string;
  kind: "crawl" | "visibility";
  status: string;
  createdAt: string;
  finishedAt: string | null;
  progress: { done: number; total: number };
  error?: string | null;
}

export function readMetrics(v: unknown): VisibilityMetrics | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Partial<VisibilityMetrics>;
  if (typeof m.visibilityIndex !== "number") return null;
  return {
    sampleSize: m.sampleSize ?? 0,
    collected: m.collected ?? 0,
    mentionRate: m.mentionRate ?? 0,
    citationRate: m.citationRate ?? 0,
    recommendationRate: m.recommendationRate ?? 0,
    competitorShare: m.competitorShare ?? {},
    citationSources: m.citationSources ?? [],
    byProvider: m.byProvider ?? {},
    visibilityIndex: m.visibilityIndex,
    formulaVersion: m.formulaVersion ?? "1",
    window: m.window ?? { from: "", to: "" },
    simulated: m.simulated ?? false,
  };
}

export async function getProjectDashboard(organizationId: string, projectId: string) {
  const where = { organizationId, projectId };
  const [visRuns, crawlRuns, findingGroups, actionGroups, topActions, lastCrawl, promptCount, appliedCount] = await Promise.all([
    db.visibilityRun.findMany({ where, orderBy: { createdAt: "asc" }, take: 200 }),
    db.crawlRun.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditFinding.groupBy({ by: ["severity"], where: { ...where, status: "open" }, _count: { _all: true } }),
    db.action.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.action.findMany({
      where: { ...where, status: { in: ["awaiting_approval", "proposed", "approved"] } },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.crawlRun.findFirst({ where: { ...where, status: { in: DONE } }, orderBy: { createdAt: "desc" } }),
    db.trackedPrompt.count({ where: { ...where, active: true } }),
    db.action.count({ where: appliedChangeWhere(organizationId, projectId) }),
  ]);

  const history: HistoryPoint[] = [];
  let latest: { runId: string; metrics: VisibilityMetrics; providers: string[]; finishedAt: string | null; promptSetVersion: number } | null = null;
  for (const r of visRuns) {
    if (!DONE.includes(r.status)) continue;
    const m = readMetrics(r.metrics);
    if (!m) continue;
    const prev = history[history.length - 1];
    history.push({
      runId: r.id,
      at: (r.finishedAt ?? r.createdAt).toISOString(),
      visibilityIndex: m.visibilityIndex,
      mentionRate: m.mentionRate,
      citationRate: m.citationRate,
      recommendationRate: m.recommendationRate,
      sampleSize: m.sampleSize,
      promptSetVersion: r.promptSetVersion,
      simulated: m.simulated,
      discontinuity: !!prev && prev.promptSetVersion !== r.promptSetVersion,
    });
    latest = {
      runId: r.id,
      metrics: m,
      providers: Array.isArray(r.providers) ? (r.providers as string[]) : Object.keys(m.byProvider),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      promptSetVersion: r.promptSetVersion,
    };
  }

  const findingsBySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<string, number>;
  for (const g of findingGroups) findingsBySeverity[g.severity] = g._count._all;
  const actionsByStatus: Record<string, number> = {};
  for (const g of actionGroups) actionsByStatus[g.status] = g._count._all;

  const recentRuns: RecentRun[] = [
    ...crawlRuns.map((c) => ({
      id: c.id,
      kind: "crawl" as const,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      finishedAt: c.finishedAt?.toISOString() ?? null,
      progress: { done: c.pagesCrawled, total: Math.max(c.pagesFound, c.pagesCrawled) },
      error: c.error,
    })),
    ...visRuns.slice(-10).map((v) => ({
      id: v.id,
      kind: "visibility" as const,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      finishedAt: v.finishedAt?.toISOString() ?? null,
      progress: { done: v.collected + v.failed, total: v.sampleSize },
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const activeRuns = recentRuns.filter((r) => ACTIVE_RUN_STATUSES.includes(r.status));

  return {
    latest,
    history,
    findings: {
      bySeverity: findingsBySeverity,
      totalOpen: Object.values(findingsBySeverity).reduce((a, b) => a + b, 0),
      pagesCrawled: lastCrawl?.pagesCrawled ?? 0,
      crawledAt: (lastCrawl?.finishedAt ?? lastCrawl?.createdAt)?.toISOString() ?? null,
    },
    /** applied = changes that reached the site (auto-applied or completed manually), excluding class A briefs. */
    actions: { byStatus: actionsByStatus, top: topActions, applied: appliedCount },
    activePromptCount: promptCount,
    recentRuns,
    activeRuns,
  };
}

export type ProjectDashboard = Awaited<ReturnType<typeof getProjectDashboard>>;
