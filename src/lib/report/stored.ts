// Stored reports (round 5 contract). The full SiteReport is built ONCE when a crawl or AI-visibility run
// finishes (src/lib/snapshots writeSnapshot → ReportSnapshot.report), including the only paid LLM summary.
// Request-time readers (overview, report page, report API, share links) call getStoredReport, which never
// calls an LLM: it serves the stored report, or builds a template-only report when none is usable.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSiteReport } from "@/lib/report/build";
import type { SiteReport } from "@/lib/report/types";

const VIS_DONE = ["succeeded", "succeeded_with_warnings"];

/** Minimal shape check so a malformed/legacy JSON blob falls back to a fresh build instead of crashing a page. */
export function isSiteReport(v: unknown): v is SiteReport {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<SiteReport>;
  return typeof r.projectId === "string" && !!r.overall && Array.isArray(r.pillars) && Array.isArray(r.issues) && !!r.crawl && !!r.aiVisibility;
}

/**
 * Newest stored report for the project, or a template-only build (no LLM) when there is none or it is
 * older than the latest finished crawl / AI check (e.g. the snapshot write failed, or pre-round-5 data).
 */
export async function getStoredReport(projectId: string, organizationId: string): Promise<SiteReport | null> {
  const [snap, latestCrawl, latestVis] = await Promise.all([
    db.reportSnapshot.findFirst({
      where: { organizationId, projectId, report: { not: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
      select: { report: true, createdAt: true },
    }),
    db.crawlRun.findFirst({
      where: { organizationId, projectId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.visibilityRun.findFirst({
      where: { organizationId, projectId, status: { in: VIS_DONE } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  const stored = snap?.report;
  if (isSiteReport(stored)) {
    const crawlCurrent = (stored.crawl.crawlRunId ?? null) === (latestCrawl?.id ?? null);
    const visCurrent = !latestVis?.finishedAt || latestVis.finishedAt.getTime() <= snap!.createdAt.getTime();
    if (crawlCurrent && visCurrent) return stored;
  }
  return buildSiteReport(projectId, organizationId); // template summary only — never an LLM call on a read
}
