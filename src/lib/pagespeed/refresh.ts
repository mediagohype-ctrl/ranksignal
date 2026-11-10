// After the audit-depth pass finishes, rebuild the stored report for that crawl so the report, problem pages and
// history show real speed data and the new probe-based checks. No LLM call: the stored AI-written summary is
// kept only when the overall score didn't change (otherwise it could quote an old number).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { buildSiteReport } from "@/lib/report/build";
import { isSiteReport } from "@/lib/report/stored";
import { issueCounts } from "@/lib/report/issues";
import { SNAPSHOT_PILLARS } from "@/lib/snapshots/types";

/** Never throws. Returns true when a stored report was updated. */
export async function refreshStoredReport(organizationId: string, projectId: string, crawlRunId: string): Promise<boolean> {
  try {
    const snap = await db.reportSnapshot.findFirst({
      where: { organizationId, projectId, report: { not: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, report: true, visibilityRunId: true },
    });
    const old = snap?.report;
    if (!snap || !isSiteReport(old) || old.crawl.crawlRunId !== crawlRunId) return false;

    // Rebuild the same way the snapshot writer did for this kind of snapshot.
    const fresh =
      snap.kind === "visibility" && snap.visibilityRunId
        ? await buildSiteReport(projectId, organizationId, { visibilityRunId: snap.visibilityRunId })
        : await buildSiteReport(projectId, organizationId, { crawlRunId });
    if (fresh.crawl.crawlRunId !== crawlRunId) return false; // a newer crawl landed meanwhile
    if (old.executiveSummarySource === "llm" && old.overall.score === fresh.overall.score) {
      fresh.executiveSummary = old.executiveSummary;
      fresh.executiveSummarySource = "llm";
    }
    const pillarScores = Object.fromEntries(SNAPSHOT_PILLARS.map((p) => [p, fresh.pillars.find((x) => x.pillar === p)?.score ?? null]));
    await db.reportSnapshot.updateMany({
      where: { id: snap.id, organizationId },
      data: {
        report: fresh as unknown as Prisma.InputJsonValue,
        overallScore: fresh.overall.score,
        grade: fresh.overall.grade,
        pillarScores: pillarScores as Prisma.InputJsonValue,
        openIssues: issueCounts(fresh.issues) as unknown as Prisma.InputJsonValue,
      },
    });
    return true;
  } catch (err) {
    log.warn("audit_depth.report_refresh_failed", { projectId, orgId: organizationId, crawlRunId, err });
    return false;
  }
}
