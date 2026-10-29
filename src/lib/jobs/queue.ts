// Durable, DB-backed workflow queue (blueprint §2.3–2.4). Swap for Trigger.dev later by
// keeping enqueue()/registerHandler() as the seam. State lives in WorkflowRun rows, never memory.
//
// Reliability rules (round 5 backend review):
//  - Runs that write to customer websites (execute_action, rollback) are NEVER reclaimed after a crash or
//    restart: re-running them could apply a change twice. They go to failed/"needs_review" + staff notification.
//  - Fencing: every state write after claim is conditional on `lockedBy = WORKER_ID`. count=0 means another
//    worker (or recovery) took the run over, so this worker stops writing.
//  - Each kind has a max run duration; on timeout the run is aborted, heartbeats stop, and it is settled.
//  - Claiming is one atomic SQL statement (FOR UPDATE SKIP LOCKED), safe with several workers.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { JobError, type WorkflowKind, type WorkflowState } from "@/lib/types";

export interface JobContext {
  run: { id: string; organizationId: string; projectId: string | null; input: Record<string, unknown>; attempts: number };
  /** Record a state transition + event (audit trail for the run). Throws LostOwnershipError when fenced out. */
  transition(to: WorkflowState, eventName: string, data?: Record<string, unknown>): Promise<void>;
  event(name: string, data?: Record<string, unknown>): Promise<void>;
  /** Aborted on max-duration timeout or graceful shutdown. Long handlers should check it between steps. */
  signal?: AbortSignal;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | void>;

/** errorClass stored on WorkflowRun for runs a human must check (possible partial write to a customer site). */
export const NEEDS_REVIEW = "needs_review";
/** Kinds that write to customer sites: never reclaimed, never released, never blind-retried. */
export const SITE_WRITE_KINDS: readonly string[] = ["execute_action", "rollback"];
const MINUTE = 60_000;
/** Max wall-clock run time per kind. */
export const MAX_RUN_MS: Record<string, number> = {
  crawl: 45 * MINUTE,
  visibility: 90 * MINUTE,
  analyze: 10 * MINUTE,
  execute_action: 5 * MINUTE,
  rollback: 5 * MINUTE,
};
const DEFAULT_MAX_RUN_MS = 30 * MINUTE;

/** The handler's run was taken over (fence lost): stop writing. */
export class LostOwnershipError extends Error {
  constructor(runId: string) {
    super(`Lost ownership of run ${runId}`);
  }
}
class RunAbort extends Error {
  constructor(public reason: "timeout" | "shutdown", ms = 0) {
    super(reason === "timeout" ? `Run exceeded max duration (${Math.round(ms / 60_000)} min)` : "Worker shutting down");
  }
}

interface Inflight {
  id: string;
  kind: string;
  organizationId: string;
  controller: AbortController;
  done: Promise<void>;
}

// Next.js bundles route handlers and instrumentation separately, so module-level state would be
// duplicated per bundle. Keep queue state on globalThis so one process shares one registry.
interface QueueState {
  handlers: Map<WorkflowKind, JobHandler>;
  active: number;
  kickScheduled: boolean;
  started: boolean;
  stopping?: boolean;
  inflight?: Map<string, Inflight>;
  lastTickAt?: number | null;
  idleDelayMs?: number;
  loopTimer?: ReturnType<typeof setTimeout> | null;
  workerId?: string;
}
const g = globalThis as unknown as { __jobQueue?: QueueState };
const state: QueueState = (g.__jobQueue ??= { handlers: new Map(), active: 0, kickScheduled: false, started: false });
state.inflight ??= new Map();
state.lastTickAt ??= null;
const handlers = state.handlers;
const inflight: Map<string, Inflight> = state.inflight;

export function registerHandler(kind: WorkflowKind, fn: JobHandler) {
  handlers.set(kind, fn);
}

export async function enqueue(opts: {
  kind: WorkflowKind;
  organizationId: string;
  projectId?: string;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
}) {
  if (opts.idempotencyKey) {
    const existing = await db.workflowRun.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (existing) return existing;
  }
  const run = await db.workflowRun.create({
    data: {
      kind: opts.kind,
      organizationId: opts.organizationId,
      projectId: opts.projectId,
      input: (opts.input ?? {}) as Prisma.InputJsonValue,
      idempotencyKey: opts.idempotencyKey,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    },
  });
  await db.workflowEvent.create({ data: { workflowRunId: run.id, name: `${opts.kind}.queued`, toState: "queued" } });
  kick();
  return run;
}

function backoffMs(attempt: number) {
  const base = Math.min(60_000, 2_000 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2); // exponential backoff with jitter
}

// Shared via globalThis so every bundle in this process fences with the same id.
export const WORKER_ID = (state.workerId ??= `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
export const LOCK_TIMEOUT_MS = 10 * 60_000;
// While a handler runs its lock is refreshed on this interval, so a lock older than LOCK_TIMEOUT_MS
// means the worker died (e.g. a deploy restart) and the run can safely be reclaimed.
const HEARTBEAT_MS = 60_000;
/** Non-terminal states a handler can leave a run in while it works. */
export const IN_PROGRESS_STATES = ["running", "preflight", "executing", "validating", "rollback_pending"];
const MAX_CONCURRENT = 4;
const BUSY_POLL_MS = 1_000;
const MAX_IDLE_POLL_MS = 30_000;
const TERMINAL = ["succeeded", "succeeded_with_warnings", "awaiting_approval", "blocked", "rejected", "rolled_back", "rollback_failed", "cancelled", "failed"];

export interface ClaimCandidate {
  kind: string;
  state: string;
  runAfter: Date;
  lockedAt: Date | null;
}

/**
 * Pure mirror of the claim SQL's eligibility (kept in sync; used by tests and documentation):
 * due queued/retry runs whose lock is free or stale, plus abandoned in-progress runs EXCEPT site-write kinds.
 */
export function isClaimable(r: ClaimCandidate, now: Date): boolean {
  const stale = now.getTime() - LOCK_TIMEOUT_MS;
  const lockFreeOrStale = r.lockedAt === null || r.lockedAt.getTime() < stale;
  if (["queued", "retry_scheduled"].includes(r.state)) return r.runAfter.getTime() <= now.getTime() && lockFreeOrStale;
  if (IN_PROGRESS_STATES.includes(r.state)) return r.lockedAt !== null && r.lockedAt.getTime() < stale && !SITE_WRITE_KINDS.includes(r.kind);
  return false;
}

/** The single-statement claim. Exported for tests. */
export function claimSql(now: Date) {
  const stale = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  // @updatedAt is set client-side by Prisma, so raw SQL must set it explicitly.
  return Prisma.sql`
    UPDATE "WorkflowRun"
       SET "lockedAt" = ${now}, "lockedBy" = ${WORKER_ID}, "state" = 'running', "attempts" = "attempts" + 1, "updatedAt" = ${now}
     WHERE "id" = (
       SELECT "id" FROM "WorkflowRun"
        WHERE ("state" IN ('queued', 'retry_scheduled') AND "runAfter" <= ${now} AND ("lockedAt" IS NULL OR "lockedAt" < ${stale}))
           OR ("state" IN (${Prisma.join(IN_PROGRESS_STATES)}) AND "lockedAt" < ${stale} AND "kind" NOT IN (${Prisma.join([...SITE_WRITE_KINDS])}))
        ORDER BY "runAfter" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING *`;
}

type RunRow = Prisma.WorkflowRunGetPayload<object>;

/** Atomically claim one due run. Returns null when nothing is due. */
async function claim(): Promise<RunRow | null> {
  const rows = await db.$queryRaw<RunRow[]>(claimSql(new Date()));
  return rows[0] ?? null;
}

/** Fenced write: only applies while this worker still owns the run. Returns false when ownership was lost. */
export async function fencedUpdate(runId: string, data: Prisma.WorkflowRunUpdateManyMutationInput): Promise<boolean> {
  const res = await db.workflowRun.updateMany({ where: { id: runId, lockedBy: WORKER_ID }, data });
  if (res.count === 0) {
    log.warn("queue.lost_ownership", { runId, workerId: WORKER_ID });
    return false;
  }
  return true;
}

/** Tell staff (in-app, via their own memberships) that a site-write run needs a human. Never throws. */
export async function notifyStaffNeedsReview(run: { id: string; kind: string; organizationId: string; projectId: string | null }, reason: string) {
  try {
    const staff = await db.membership.findMany({
      where: { status: "active", user: { isStaff: true } },
      select: { userId: true, organizationId: true },
      orderBy: { createdAt: "asc" },
    });
    const seen = new Set<string>();
    const rows = staff.filter((m) => (seen.has(m.userId) ? false : (seen.add(m.userId), true)));
    const title = `Website change needs review (${run.kind.replace(/_/g, " ")})`;
    const body =
      `Run ${run.id} for organization ${run.organizationId} stopped mid-way (${reason}). It was NOT retried automatically ` +
      `because the change may already be live. Check the page and the action's before-state, then re-run or roll back by hand.`;
    if (rows.length === 0) {
      log.warn("queue.needs_review_no_staff", { runId: run.id, kind: run.kind, orgId: run.organizationId });
      return;
    }
    await db.notification.createMany({
      data: rows.map((m) => ({ organizationId: m.organizationId, userId: m.userId, type: "job_failed", title, body, link: "/admin" })),
    });
  } catch (err) {
    log.error("queue.needs_review_notify_failed", { runId: run.id, err });
  }
}

/** Settle a site-write run as failed/needs_review (fenced on `where`), with event + staff notification. */
async function markNeedsReview(
  run: { id: string; kind: string; organizationId: string; projectId: string | null },
  reason: string,
  where: Prisma.WorkflowRunWhereInput,
  release: boolean,
): Promise<boolean> {
  const res = await db.workflowRun.updateMany({
    where: { id: run.id, ...where },
    data: { state: "failed", errorClass: NEEDS_REVIEW, error: `Needs review: ${reason}`.slice(0, 2000), ...(release ? { lockedAt: null, lockedBy: null } : {}) },
  });
  if (res.count === 0) return false;
  log.error("queue.needs_review", { runId: run.id, kind: run.kind, orgId: run.organizationId, reason });
  await db.workflowEvent.create({ data: { workflowRunId: run.id, name: `${run.kind}.needs_review`, toState: "failed", data: { reason } } }).catch(() => undefined);
  await notifyStaffNeedsReview(run, reason);
  return true;
}

/**
 * Site-write runs abandoned by a dead worker (in progress, lock stale) are never reclaimed; flag them for a
 * human instead. Called from recovery (scheduler tick) and at worker start.
 */
export async function flagAbandonedSiteWrites(now = new Date()): Promise<number> {
  const stale = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const rows = await db.workflowRun.findMany({
    where: { kind: { in: [...SITE_WRITE_KINDS] }, state: { in: IN_PROGRESS_STATES }, lockedAt: { lt: stale } },
    select: { id: true, kind: true, organizationId: true, projectId: true, lockedAt: true, state: true },
    take: 100,
  });
  let n = 0;
  for (const r of rows) {
    // Conditional on the lock we saw: if the owner heartbeated meanwhile, leave it alone.
    if (await markNeedsReview(r, "worker stopped while the change was being applied", { lockedAt: r.lockedAt, state: r.state }, true)) n++;
  }
  return n;
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

async function execute(run: RunRow, controller: AbortController) {
  const handler = handlers.get(run.kind as WorkflowKind);
  const siteWrite = SITE_WRITE_KINDS.includes(run.kind);
  const fields = { runId: run.id, kind: run.kind, orgId: run.organizationId };
  let current = run.state as WorkflowState;
  const ctx: JobContext = {
    run: {
      id: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      input: (run.input ?? {}) as Record<string, unknown>,
      attempts: run.attempts,
    },
    signal: controller.signal,
    async transition(to, eventName, data = {}) {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (!(await fencedUpdate(run.id, { state: to }))) throw new LostOwnershipError(run.id);
      await db.workflowEvent.create({
        data: { workflowRunId: run.id, name: eventName, fromState: current, toState: to, data: data as Prisma.InputJsonValue },
      });
      current = to;
    },
    async event(name, data = {}) {
      await db.workflowEvent.create({ data: { workflowRunId: run.id, name, data: data as Prisma.InputJsonValue } });
    },
  };

  if (run.attempts > run.maxAttempts) {
    if (await fencedUpdate(run.id, { state: "failed", error: "Interrupted too many times (worker restarts)", errorClass: "transient", lockedAt: null, lockedBy: null })) {
      await ctx.event(`${run.kind}.failed`, { error: "attempts_exhausted" });
      log.error("queue.job_failed", { ...fields, error: "attempts_exhausted" });
    }
    return;
  }
  if (!handler) {
    await fencedUpdate(run.id, { state: "failed", error: `No handler for ${run.kind}`, errorClass: "permanent", lockedAt: null, lockedBy: null });
    log.error("queue.job_failed", { ...fields, error: "no_handler" });
    return;
  }

  const maxMs = MAX_RUN_MS[run.kind] ?? DEFAULT_MAX_RUN_MS;
  const timer = setTimeout(() => controller.abort(new RunAbort("timeout", maxMs)), maxMs);
  const heartbeat = setInterval(() => {
    void db.workflowRun
      .updateMany({ where: { id: run.id, lockedBy: WORKER_ID }, data: { lockedAt: new Date() } })
      .catch(() => undefined);
  }, HEARTBEAT_MS);
  // An aborted run must stop heartbeating at once, so its lock goes stale and nobody thinks it is alive.
  controller.signal.addEventListener("abort", () => clearInterval(heartbeat), { once: true });
  try {
    const work = handler(ctx);
    // After an abort the handler keeps running detached; mark its eventual rejection handled so it can't
    // become an unhandledRejection (which would crash the process).
    work.catch(() => undefined);
    const output = (await Promise.race([work, abortPromise(controller.signal)])) ?? {};
    await fencedUpdate(run.id, {
      state: TERMINAL.includes(current) ? current : "succeeded",
      output: output as Prisma.InputJsonValue,
      lockedAt: null,
      lockedBy: null,
      error: null,
      errorClass: null,
    });
  } catch (err) {
    if (err instanceof LostOwnershipError) return; // someone else settled the run; don't touch it
    if (err instanceof RunAbort && err.reason === "shutdown") return; // shutdownWorker() settles it
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof RunAbort;
    const flagged = (err as { errorClass?: unknown } | null)?.errorClass === NEEDS_REVIEW;
    if (siteWrite && (timedOut || flagged)) {
      // A site write that timed out may or may not have landed: never retry blindly.
      await markNeedsReview(run, timedOut ? message : message || "connector state did not match", { lockedBy: WORKER_ID }, true);
      return;
    }
    const errorClass = err instanceof JobError ? err.errorClass : timedOut ? "permanent" : "transient";
    const retry = errorClass === "transient" && run.attempts < run.maxAttempts;
    const ok = await fencedUpdate(run.id, {
      state: retry ? "retry_scheduled" : "failed",
      error: message.slice(0, 2000),
      errorClass,
      lockedAt: null,
      lockedBy: null,
      runAfter: retry ? new Date(Date.now() + backoffMs(run.attempts)) : undefined,
    });
    if (!ok) return;
    await ctx.event(`${run.kind}.${retry ? "retry_scheduled" : "failed"}`, { error: message.slice(0, 500), errorClass });
    (retry ? log.warn : log.error)(retry ? "queue.job_retry_scheduled" : "queue.job_failed", {
      ...fields,
      attempts: run.attempts,
      errorClass,
      err: err instanceof Error ? err : message,
    });
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
  }
}

/** Drain due runs up to the concurrency limit. Safe to call often. Returns how many runs were claimed. */
export async function tick(): Promise<number> {
  state.lastTickAt = Date.now();
  let claimed = 0;
  while (!state.stopping && state.active < MAX_CONCURRENT) {
    const run = await claim();
    if (!run) break;
    claimed++;
    state.active++;
    const controller = new AbortController();
    const entry: Inflight = { id: run.id, kind: run.kind, organizationId: run.organizationId, controller, done: Promise.resolve() };
    entry.done = execute(run, controller)
      .catch((err) => log.error("queue.execute_crashed", { runId: run.id, kind: run.kind, orgId: run.organizationId, err }))
      .finally(() => {
        state.active--;
        inflight.delete(run.id);
        if (!state.stopping) kick();
      });
    inflight.set(run.id, entry);
  }
  return claimed;
}

function kick() {
  if (state.kickScheduled || state.stopping) return;
  state.kickScheduled = true;
  setTimeout(() => {
    state.kickScheduled = false;
    void tick().catch((err) => log.error("queue.tick_failed", { err }));
  }, 50);
}

/** Poll delay: 1s while busy, doubling up to 30s while idle. */
export function nextPollDelay(prevMs: number, busy: boolean): number {
  return busy ? BUSY_POLL_MS : Math.min(MAX_IDLE_POLL_MS, Math.max(BUSY_POLL_MS, prevMs * 2));
}

/** In-process poller for single-node deployments (RUN_WORKER_IN_APP). */
export function startWorker() {
  if (state.started) return;
  state.started = true;
  state.stopping = false;
  state.idleDelayMs = BUSY_POLL_MS;
  void flagAbandonedSiteWrites().catch((err) => log.error("queue.flag_abandoned_failed", { err }));
  const loop = async () => {
    if (state.stopping) return;
    let busy = false;
    try {
      busy = (await tick()) > 0 || state.active > 0;
    } catch (err) {
      log.error("queue.tick_failed", { err });
    }
    state.idleDelayMs = nextPollDelay(state.idleDelayMs ?? BUSY_POLL_MS, busy);
    if (!state.stopping) state.loopTimer = setTimeout(() => void loop(), state.idleDelayMs);
  };
  state.loopTimer = setTimeout(() => void loop(), BUSY_POLL_MS);
}

/** In-process worker status for /api/health. */
export function getWorkerStatus() {
  return {
    started: state.started,
    stopping: Boolean(state.stopping),
    lastTickAt: state.lastTickAt ? new Date(state.lastTickAt).toISOString() : null,
    active: state.active,
    workerId: WORKER_ID,
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function waitFor(entries: Inflight[], ms: number) {
  if (entries.length === 0) return;
  await Promise.race([Promise.all(entries.map((e) => e.done)), sleep(ms)]);
}

/**
 * Graceful shutdown (SIGTERM): stop claiming, give in-flight runs `graceMs` to finish, then
 *  - scans (crawl/visibility/analyze): release back to the queue — retry_scheduled, unlocked, attempts
 *    decremented (a deploy must not burn an attempt), runAfter now — so the next process resumes them;
 *  - site writes: never released. They get `siteWriteGraceMs` more to finish; any still running are marked
 *    needs_review (if one then completes, its fenced success write still lands).
 */
export async function shutdownWorker(o: { graceMs?: number; siteWriteGraceMs?: number } = {}) {
  state.stopping = true;
  if (state.loopTimer) clearTimeout(state.loopTimer);
  const graceMs = o.graceMs ?? 20_000;
  log.info("queue.shutdown_started", { inflight: inflight.size, workerId: WORKER_ID });
  await waitFor([...inflight.values()], graceMs);

  const remaining = [...inflight.values()];
  const scans = remaining.filter((e) => !SITE_WRITE_KINDS.includes(e.kind));
  const writes = remaining.filter((e) => SITE_WRITE_KINDS.includes(e.kind));
  for (const e of scans) {
    e.controller.abort(new RunAbort("shutdown"));
    const ok = await fencedUpdate(e.id, { state: "retry_scheduled", lockedAt: null, lockedBy: null, attempts: { decrement: 1 }, runAfter: new Date() }).catch(() => false);
    if (ok) {
      await db.workflowEvent.create({ data: { workflowRunId: e.id, name: `${e.kind}.released`, toState: "retry_scheduled", data: { reason: "shutdown" } } }).catch(() => undefined);
      log.info("queue.run_released", { runId: e.id, kind: e.kind, orgId: e.organizationId });
    }
  }
  if (writes.length) {
    await waitFor(writes, o.siteWriteGraceMs ?? 20_000);
    for (const e of writes.filter((w) => inflight.has(w.id))) {
      await markNeedsReview({ id: e.id, kind: e.kind, organizationId: e.organizationId, projectId: null }, "server shut down while the change was being applied", { lockedBy: WORKER_ID }, false).catch(() => false);
    }
  }
  log.info("queue.shutdown_done", { released: scans.length, siteWrites: writes.length });
}

/** Test seam: reset in-process state. */
export function __resetQueueForTests() {
  state.active = 0;
  state.started = false;
  state.stopping = false;
  state.kickScheduled = false;
  state.lastTickAt = null;
  inflight.clear();
  handlers.clear();
}
/** Test seam: claim + execute one run synchronously. */
export async function __runOnceForTests(): Promise<string | null> {
  const run = await claim();
  if (!run) return null;
  await execute(run, new AbortController());
  return run.id;
}
