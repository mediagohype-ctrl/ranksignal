// Scheduler step: during the first 3 UTC days of a month, draft/send last month's report for every project
// that had activity (a real snapshot or shipped work) in that month. Idempotent via the (projectId, period)
// unique key; a few projects per tick keep each tick short.
import { db } from "@/lib/db";
import { getOrgAccess } from "@/lib/billing/access";
import { listShippedWork } from "@/lib/tasks";
import { generateMonthlyReport } from "./generate";
import { periodRange, previousPeriod } from "./period";

export const MONTHLY_GENERATION_LAST_DAY = 3;
export const MONTHLY_REPORTS_PER_TICK = 3;
/** Stop starting new reports after this long so the tick stays well inside its transaction timeout. */
const TICK_BUDGET_MS = 120_000;

export function isMonthlyWindow(now: Date): boolean {
  return now.getUTCDate() <= MONTHLY_GENERATION_LAST_DAY;
}

/** Returns the number of reports generated this tick. */
export async function scheduleMonthlyReports(now: Date = new Date(), limit = MONTHLY_REPORTS_PER_TICK): Promise<number> {
  if (!isMonthlyWindow(now)) return 0;
  const period = previousPeriod(now);
  const range = periodRange(period);

  const done = await db.monthlyReport.findMany({ where: { period }, select: { projectId: true } });
  const doneIds = new Set(done.map((r) => r.projectId));
  const projects = (
    await db.project.findMany({
      where: { createdAt: { lt: range.end } },
      select: { id: true, organizationId: true },
      orderBy: { createdAt: "asc" },
    })
  ).filter((p) => !doneIds.has(p.id));
  if (!projects.length) return 0;

  const withSnapshots = new Set(
    (
      await db.reportSnapshot.groupBy({
        by: ["projectId"],
        where: { projectId: { in: projects.map((p) => p.id) }, simulated: false, createdAt: { gte: range.start, lt: range.end } },
      })
    ).map((r) => r.projectId),
  );

  const orgActive = new Map<string, boolean>();
  let generated = 0;
  const started = Date.now();
  for (const p of projects) {
    if (generated >= limit || Date.now() - started > TICK_BUDGET_MS) break;
    try {
      let active = withSnapshots.has(p.id);
      if (!active) active = (await listShippedWork(p.id, p.organizationId, range.start, range.end, { clientVisibleOnly: true })).length > 0;
      if (!active) continue;
      if (!orgActive.has(p.organizationId)) {
        orgActive.set(p.organizationId, await getOrgAccess(p.organizationId, now).then((a) => a.active, () => false));
      }
      if (!orgActive.get(p.organizationId)) continue;
      await generateMonthlyReport(p.id, p.organizationId, period, { now });
      generated++;
    } catch (e) {
      console.error(`[monthly-report] generation failed for project ${p.id} ${period}:`, e instanceof Error ? e.message : e);
    }
  }
  return generated;
}
