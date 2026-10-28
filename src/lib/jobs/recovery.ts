// Recovery for runs interrupted by a restart/deploy. Two cases:
//  1. CrawlRun/VisibilityRun rows stuck in an active status > 30 min while their WorkflowRun already finished
//     (or is missing) → mark failed "Interrupted (server restart)" so the UI stops spinning and new scans can start.
//  2. WorkflowRuns left in state "running" by a dead worker. queue.ts only reclaims queued/retry_scheduled runs,
//     so a run claimed by a process that died stays "running" forever. For scan/analysis kinds (never
//     execute_action/rollback — those touch customer sites and need a human) with no sign of life for 30 min we
//     mark them failed; case 1 then settles their CrawlRun/VisibilityRun in the same pass.
import { db } from "@/lib/db";

export const STUCK_AFTER_MS = 30 * 60_000;
export const INTERRUPTED_ERROR = "Interrupted (server restart)";
const DOMAIN_ACTIVE = ["queued", "running", "retry_scheduled"];
/** WorkflowRun states from which the domain run can no longer progress. */
const WF_DONE = new Set([
  "succeeded", "succeeded_with_warnings", "failed", "cancelled", "blocked", "rejected", "rolled_back", "rollback_failed", "awaiting_approval",
]);
/** Kinds that are safe to fail automatically (read-only towards the customer's site). */
const RECOVERABLE_KINDS = ["crawl", "visibility", "analyze"];

export interface DomainRunLite {
  id: string;
  status: string;
  workflowRunId: string | null;
  createdAt: Date;
}

/** Pure: which domain runs are stuck. `wfState` maps workflowRunId → state for rows that still exist. */
export function selectStuckRuns(runs: DomainRunLite[], wfState: Map<string, string>, now: Date): string[] {
  return runs
    .filter((r) => DOMAIN_ACTIVE.includes(r.status))
    .filter((r) => now.getTime() - r.createdAt.getTime() > STUCK_AFTER_MS)
    .filter((r) => {
      if (!r.workflowRunId) return true;
      const st = wfState.get(r.workflowRunId);
      return st === undefined || WF_DONE.has(st);
    })
    .map((r) => r.id);
}

/** Pure: a "running" WorkflowRun is dead when neither its lock nor any progress signal moved recently. */
export function isWorkflowDead(o: { lockedAt: Date | null; lastSignalAt: Date | null; now: Date }): boolean {
  const cutoff = o.now.getTime() - STUCK_AFTER_MS;
  if (o.lockedAt && o.lockedAt.getTime() > cutoff) return false;
  if (o.lastSignalAt && o.lastSignalAt.getTime() > cutoff) return false;
  return true;
}

const maxDate = (...ds: (Date | null | undefined)[]) =>
  ds.reduce<Date | null>((m, d) => (d && (!m || d.getTime() > m.getTime()) ? d : m), null);

async function failDeadWorkflowRuns(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
  const candidates = await db.workflowRun.findMany({
    where: { state: "running", kind: { in: RECOVERABLE_KINDS }, OR: [{ lockedAt: null }, { lockedAt: { lt: cutoff } }] },
    select: { id: true, kind: true, input: true, lockedAt: true, updatedAt: true },
    take: 100,
  });
  let failed = 0;
  for (const wf of candidates) {
    const input = (wf.input as Record<string, unknown> | null) ?? {};
    const [lastEvent, lastPage, lastObs] = await Promise.all([
      db.workflowEvent.findFirst({ where: { workflowRunId: wf.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      wf.kind === "crawl" && typeof input.crawlRunId === "string"
        ? db.crawlPage.findFirst({ where: { crawlRunId: input.crawlRunId }, orderBy: { crawledAt: "desc" }, select: { crawledAt: true } })
        : null,
      wf.kind === "visibility" && typeof input.visibilityRunId === "string"
        ? db.observation.findFirst({ where: { visibilityRunId: input.visibilityRunId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
        : null,
    ]);
    const lastSignalAt = maxDate(wf.updatedAt, lastEvent?.createdAt, lastPage?.crawledAt, lastObs?.createdAt);
    if (!isWorkflowDead({ lockedAt: wf.lockedAt, lastSignalAt, now })) continue;
    // Conditional update: if the worker finished it meanwhile, leave it alone.
    const res = await db.workflowRun.updateMany({
      where: { id: wf.id, state: "running", lockedAt: wf.lockedAt },
      data: { state: "failed", error: INTERRUPTED_ERROR, errorClass: "transient", lockedAt: null },
    });
    if (res.count === 1) {
      failed++;
      await db.workflowEvent.create({ data: { workflowRunId: wf.id, name: `${wf.kind}.interrupted`, fromState: "running", toState: "failed" } });
    }
  }
  return failed;
}

async function failStuckDomainRuns(kind: "crawl" | "visibility", now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
  const where = { status: { in: DOMAIN_ACTIVE }, createdAt: { lt: cutoff } };
  const select = { id: true, status: true, workflowRunId: true, createdAt: true } as const;
  const runs: DomainRunLite[] =
    kind === "crawl"
      ? await db.crawlRun.findMany({ where, select, take: 200 })
      : await db.visibilityRun.findMany({ where, select, take: 200 });
  if (runs.length === 0) return 0;
  const wfIds = runs.map((r) => r.workflowRunId).filter((x): x is string => Boolean(x));
  const wfs = wfIds.length ? await db.workflowRun.findMany({ where: { id: { in: wfIds } }, select: { id: true, state: true } }) : [];
  const stuck = selectStuckRuns(runs, new Map(wfs.map((w) => [w.id, w.state])), now);
  if (stuck.length === 0) return 0;
  const guard = { id: { in: stuck }, status: { in: DOMAIN_ACTIVE } };
  const res =
    kind === "crawl"
      ? await db.crawlRun.updateMany({ where: guard, data: { status: "failed", error: INTERRUPTED_ERROR, finishedAt: now } })
      : await db.visibilityRun.updateMany({ where: guard, data: { status: "failed", finishedAt: now } }); // no error column
  return res.count;
}

/** Run at boot and on every scheduler tick. Returns counts for logging. */
export async function recoverInterruptedRuns(now = new Date()) {
  const workflows = await failDeadWorkflowRuns(now);
  const crawls = await failStuckDomainRuns("crawl", now);
  const visibility = await failStuckDomainRuns("visibility", now);
  if (workflows + crawls + visibility > 0) {
    console.info(`[recovery] marked interrupted: ${workflows} workflow run(s), ${crawls} crawl(s), ${visibility} visibility run(s)`);
  }
  return { workflows, crawls, visibility };
}
