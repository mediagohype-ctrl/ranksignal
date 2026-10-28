// Durable, DB-backed workflow queue (blueprint §2.3–2.4). Swap for Trigger.dev later by
// keeping enqueue()/registerHandler() as the seam. State lives in WorkflowRun rows, never memory.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { JobError, type WorkflowKind, type WorkflowState } from "@/lib/types";

export interface JobContext {
  run: { id: string; organizationId: string; projectId: string | null; input: Record<string, unknown>; attempts: number };
  /** Record a state transition + event (audit trail for the run). */
  transition(to: WorkflowState, eventName: string, data?: Record<string, unknown>): Promise<void>;
  event(name: string, data?: Record<string, unknown>): Promise<void>;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | void>;

// Next.js bundles route handlers and instrumentation separately, so module-level state would be
// duplicated per bundle. Keep queue state on globalThis so one process shares one registry.
const g = globalThis as unknown as { __jobQueue?: { handlers: Map<WorkflowKind, JobHandler>; active: number; kickScheduled: boolean; started: boolean } };
const state = (g.__jobQueue ??= { handlers: new Map(), active: 0, kickScheduled: false, started: false });
const handlers = state.handlers;

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

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const LOCK_TIMEOUT_MS = 10 * 60_000;
const MAX_CONCURRENT = 4;

/** Claim one due run with an optimistic lock. Returns null when nothing is due. */
async function claim() {
  const now = new Date();
  const candidate = await db.workflowRun.findFirst({
    where: {
      state: { in: ["queued", "retry_scheduled"] },
      runAfter: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } }],
    },
    orderBy: { runAfter: "asc" },
  });
  if (!candidate) return null;
  const res = await db.workflowRun.updateMany({
    where: { id: candidate.id, lockedAt: candidate.lockedAt },
    data: { lockedAt: now, lockedBy: WORKER_ID, state: "running", attempts: { increment: 1 } },
  });
  return res.count === 1 ? db.workflowRun.findUnique({ where: { id: candidate.id } }) : null;
}

async function execute(run: NonNullable<Awaited<ReturnType<typeof claim>>>) {
  const handler = handlers.get(run.kind as WorkflowKind);
  let current = run.state as WorkflowState;
  const ctx: JobContext = {
    run: {
      id: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      input: (run.input ?? {}) as Record<string, unknown>,
      attempts: run.attempts,
    },
    async transition(to, eventName, data = {}) {
      await db.$transaction([
        db.workflowRun.update({ where: { id: run.id }, data: { state: to } }),
        db.workflowEvent.create({
          data: { workflowRunId: run.id, name: eventName, fromState: current, toState: to, data: data as Prisma.InputJsonValue },
        }),
      ]);
      current = to;
    },
    async event(name, data = {}) {
      await db.workflowEvent.create({ data: { workflowRunId: run.id, name, data: data as Prisma.InputJsonValue } });
    },
  };

  if (!handler) {
    await db.workflowRun.update({ where: { id: run.id }, data: { state: "failed", error: `No handler for ${run.kind}`, errorClass: "permanent", lockedAt: null } });
    return;
  }
  try {
    const output = (await handler(ctx)) ?? {};
    const terminal = ["succeeded", "succeeded_with_warnings", "awaiting_approval", "blocked", "rejected", "rolled_back", "rollback_failed", "cancelled", "failed"];
    await db.workflowRun.update({
      where: { id: run.id },
      data: { state: terminal.includes(current) ? current : "succeeded", output: output as Prisma.InputJsonValue, lockedAt: null, error: null },
    });
  } catch (err) {
    const errorClass = err instanceof JobError ? err.errorClass : "transient";
    const message = err instanceof Error ? err.message : String(err);
    const retry = errorClass === "transient" && run.attempts < run.maxAttempts;
    await db.workflowRun.update({
      where: { id: run.id },
      data: {
        state: retry ? "retry_scheduled" : "failed",
        error: message.slice(0, 2000),
        errorClass,
        lockedAt: null,
        runAfter: retry ? new Date(Date.now() + backoffMs(run.attempts)) : undefined,
      },
    });
    await ctx.event(`${run.kind}.${retry ? "retry_scheduled" : "failed"}`, { error: message.slice(0, 500), errorClass });
  }
}

/** Drain due runs up to the concurrency limit. Safe to call often. */
export async function tick() {
  while (state.active < MAX_CONCURRENT) {
    const run = await claim();
    if (!run) return;
    state.active++;
    execute(run).finally(() => {
      state.active--;
      void tick();
    });
  }
}

function kick() {
  if (state.kickScheduled) return;
  state.kickScheduled = true;
  setTimeout(() => {
    state.kickScheduled = false;
    void tick().catch((e) => console.error("[queue] tick failed", e));
  }, 50);
}

/** In-process poller for dev/single-node. In production run `npm run worker` as a separate process. */
export function startWorker(intervalMs = 3000) {
  if (state.started) return;
  state.started = true;
  setInterval(() => void tick().catch((e) => console.error("[queue] tick failed", e)), intervalMs);
}
