// Problem counts for a LIST of websites (project cards, portfolio) without loading each full report:
// the newest history snapshot of each website carries the same problem list, frozen (ReportSnapshot.openIssues is
// written from issueCounts(report.issues)). Definition and wording: ./counts.ts.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { problemCountsFromSnapshot, type ProblemCounts } from "@/lib/report/counts";

/**
 * projectId → counts, for the websites that have been checked. A website with no finished check has no entry —
 * show "Not checked yet", never 0.
 */
export async function loadProblemCounts(organizationId: string, projectIds: string[]): Promise<Map<string, ProblemCounts>> {
  const out = new Map<string, ProblemCounts>();
  if (projectIds.length === 0) return out;
  try {
    const rows = await db.reportSnapshot.findMany({
      where: { organizationId, projectId: { in: projectIds }, simulated: false, openIssues: { not: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
      distinct: ["projectId"],
      select: { projectId: true, openIssues: true },
    });
    for (const r of rows) {
      const c = problemCountsFromSnapshot(r.openIssues);
      if (c && !out.has(r.projectId)) out.set(r.projectId, c);
    }
  } catch (e) {
    console.error("[counts] problem counts unavailable:", e instanceof Error ? e.message : e);
  }
  return out;
}
