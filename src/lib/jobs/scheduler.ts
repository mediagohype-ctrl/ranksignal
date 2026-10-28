// Recurring scans + housekeeping. Started from bootWorker(); every 5 minutes one instance (Postgres advisory
// lock) recovers interrupted runs, enqueues due scheduled scans and sends run-completion notifications.
// Schedules live in Project.settings.schedule (absent → crawl weekly, visibility monthly).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { getPlan } from "@/lib/billing/plans";
import { getOrgAccess } from "@/lib/billing/access";
import { getVisibilityRunAllowance } from "@/lib/billing/ai-limits";
import { currentPromptSetVersion } from "@/lib/prompts/service";
import { frequencyDays, readSchedule, type ScheduleFrequency } from "@/lib/dashboard/project-schema";
import { recoverInterruptedRuns } from "@/lib/jobs/recovery";
import { dispatchRunNotifications } from "@/lib/notifications/dispatch";
import { scheduleMonthlyReports } from "@/lib/monthly-report/schedule";

export type ScanKind = "crawl" | "visibility";

const DAY_MS = 24 * 60 * 60 * 1000;
export const SCHEDULER_INTERVAL_MS = 5 * 60_000;
/** Runs become due slightly early so a weekly scan doesn't drift later by one tick every week. */
const DUE_SLACK_MS = 30 * 60_000;
/** Arbitrary constant key for pg_try_advisory_xact_lock — one scheduler across instances (deploy overlap). */
const ADVISORY_LOCK_KEY = 727_301_559;
/** Notification lookback overlap; dedupe against Notification rows makes re-scans harmless. */
export const NOTIFY_LOOKBACK_MS = 15 * 60_000;

const ACTIVE_STATUS: Record<ScanKind, string[]> = {
  crawl: ["queued", "running", "retry_scheduled"],
  visibility: ["queued", "running"],
};

/** Effective interval: the chosen frequency, never shorter than the plan's minimum scan interval. */
export function effectiveIntervalDays(freq: ScheduleFrequency, minScanIntervalDays: number): number | null {
  const d = frequencyDays(freq);
  return d === null ? null : Math.max(d, minScanIntervalDays);
}

/** Pure due-date rule used by the scheduler tick. */
export function isScanDue(o: {
  frequency: ScheduleFrequency;
  minScanIntervalDays: number;
  lastRunAt: Date | null;
  hasActiveRun: boolean;
  now: Date;
}): boolean {
  const days = effectiveIntervalDays(o.frequency, o.minScanIntervalDays);
  if (days === null || o.hasActiveRun) return false;
  if (!o.lastRunAt) return true;
  return o.now.getTime() - o.lastRunAt.getTime() >= days * DAY_MS - DUE_SLACK_MS;
}

/** One scheduled run per project, kind and UTC day — the enqueue idempotency key. */
export function scheduleIdempotencyKey(kind: ScanKind, projectId: string, now: Date): string {
  return `sched:${kind}:${projectId}:${now.toISOString().slice(0, 10)}`;
}

async function enqueueScheduled(kind: ScanKind, project: { id: string; organizationId: string }, now: Date) {
  const idempotencyKey = scheduleIdempotencyKey(kind, project.id, now);
  if (await db.workflowRun.findUnique({ where: { idempotencyKey }, select: { id: true } })) return false;
  const { organizationId } = project;

  if (kind === "crawl") {
    const run = await db.crawlRun.create({ data: { organizationId, projectId: project.id, status: "queued" } });
    try {
      const wf = await enqueue({
        kind: "crawl", organizationId, projectId: project.id,
        input: { crawlRunId: run.id, trigger: "schedule" }, idempotencyKey, maxAttempts: 3,
      });
      await db.crawlRun.update({ where: { id: run.id }, data: { workflowRunId: wf.id } });
    } catch (e) {
      await db.crawlRun.delete({ where: { id: run.id } }).catch(() => undefined);
      throw e;
    }
    return true;
  }

  const promptCount = await db.trackedPrompt.count({ where: { organizationId, projectId: project.id, active: true } });
  if (promptCount === 0) return false; // nothing to measure; the project page already prompts the user to add questions
  // Re-checked per run (it counts runs created this month, including ones enqueued earlier in this tick).
  if ((await getVisibilityRunAllowance(organizationId, now)).remaining <= 0) return false;
  const run = await db.visibilityRun.create({
    data: {
      organizationId, projectId: project.id, status: "queued",
      promptSetVersion: await currentPromptSetVersion(organizationId, project.id),
      providers: Prisma.JsonNull,
    },
  });
  try {
    const wf = await enqueue({
      kind: "visibility", organizationId, projectId: project.id,
      input: { visibilityRunId: run.id, trigger: "schedule" }, idempotencyKey,
    });
    await db.visibilityRun.update({ where: { id: run.id }, data: { workflowRunId: wf.id } });
  } catch (e) {
    await db.visibilityRun.delete({ where: { id: run.id } }).catch(() => undefined);
    throw e;
  }
  return true;
}

async function latestByProject(kind: ScanKind, projectIds: string[]) {
  const where = { projectId: { in: projectIds } };
  const [latest, active] =
    kind === "crawl"
      ? await Promise.all([
          db.crawlRun.groupBy({ by: ["projectId"], where, _max: { createdAt: true } }),
          db.crawlRun.findMany({ where: { ...where, status: { in: ACTIVE_STATUS.crawl } }, select: { projectId: true } }),
        ])
      : await Promise.all([
          db.visibilityRun.groupBy({ by: ["projectId"], where, _max: { createdAt: true } }),
          db.visibilityRun.findMany({ where: { ...where, status: { in: ACTIVE_STATUS.visibility } }, select: { projectId: true } }),
        ]);
  return {
    lastRunAt: new Map(latest.map((r) => [r.projectId, r._max.createdAt ?? null])),
    active: new Set(active.map((r) => r.projectId)),
  };
}

/** Enqueue every scheduled scan that is due. Returns the number of runs enqueued. */
export async function scheduleDueScans(now = new Date()): Promise<number> {
  const projects = await db.project.findMany({
    select: { id: true, organizationId: true, settings: true, organization: { select: { planId: true } } },
  });
  if (projects.length === 0) return 0;
  const ids = projects.map((p) => p.id);
  const runs = { crawl: await latestByProject("crawl", ids), visibility: await latestByProject("visibility", ids) };
  const orgActive = new Map<string, boolean>();
  let enqueued = 0;

  for (const p of projects) {
    const schedule = readSchedule(p.settings);
    const plan = getPlan(p.organization.planId);
    for (const kind of ["crawl", "visibility"] as const) {
      const due = isScanDue({
        frequency: schedule[kind],
        minScanIntervalDays: plan.minScanIntervalDays,
        lastRunAt: runs[kind].lastRunAt.get(p.id) ?? null,
        hasActiveRun: runs[kind].active.has(p.id),
        now,
      });
      if (!due) continue;
      if (!orgActive.has(p.organizationId)) {
        try {
          // Trial ended / unpaid / suspended → skip quietly.
          orgActive.set(p.organizationId, (await getOrgAccess(p.organizationId, now)).active);
        } catch (e) {
          console.error(`[scheduler] access check failed for org ${p.organizationId}:`, e instanceof Error ? e.message : e);
          orgActive.set(p.organizationId, false); // fail closed
        }
      }
      if (!orgActive.get(p.organizationId)) continue;
      try {
        if (await enqueueScheduled(kind, p, now)) enqueued++;
      } catch (e) {
        console.error(`[scheduler] could not enqueue ${kind} for project ${p.id}:`, e instanceof Error ? e.message : e);
      }
    }
  }
  return enqueued;
}

// ---- tick + lifecycle -------------------------------------------------------------------------------------------

const g = globalThis as unknown as { __scheduler?: { started: boolean; ticking: boolean; notifyCursor: Date | null } };
const state = (g.__scheduler ??= { started: false, ticking: false, notifyCursor: null });

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[scheduler] ${name} failed:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** One scheduler pass. Only the instance holding the advisory lock does any work. */
export async function schedulerTick(now = new Date()) {
  if (state.ticking) return;
  state.ticking = true;
  try {
    // Transaction-scoped lock: safe behind a transaction-mode pooler and auto-released if the process dies.
    await db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`;
        if (!rows[0]?.locked) return;
        await step("recovery", () => recoverInterruptedRuns(now));
        await step("schedule", () => scheduleDueScans(now));
        const since = new Date((state.notifyCursor ?? now).getTime() - NOTIFY_LOOKBACK_MS);
        const ok = await step("notifications", () => dispatchRunNotifications({ since, now }));
        if (ok !== undefined) state.notifyCursor = now;
        // Days 1-3 (UTC): last month's impact reports, a few projects per tick (idempotent per project + period).
        await step("monthly-reports", () => scheduleMonthlyReports(now));
      },
      { maxWait: 10_000, timeout: SCHEDULER_INTERVAL_MS - 30_000 },
    );
  } catch (e) {
    console.error("[scheduler] tick failed:", e instanceof Error ? e.message : e);
  } finally {
    state.ticking = false;
  }
}

/** Start the 5-minute scheduler (idempotent). First pass shortly after boot, which also runs recovery. */
export function startScheduler() {
  if (state.started || process.env.SCHEDULER_DISABLED === "true") return;
  state.started = true;
  setTimeout(() => void schedulerTick(), 20_000).unref?.();
  setInterval(() => void schedulerTick(), SCHEDULER_INTERVAL_MS).unref?.();
}
