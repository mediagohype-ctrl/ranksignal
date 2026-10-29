// Health check for Render. 503 ONLY when the database is unreachable (Render then restarts/holds traffic);
// queue problems (stalled worker, backlog) return 200 with degraded: true so a slow queue never takes the
// whole site down. No tenant data is returned.
import { db } from "@/lib/db";
import { getWorkerStatus } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

/** Worker considered stalled when it hasn't polled for this long (idle polling backs off to 30s). */
const WORKER_STALE_MS = 2 * 60_000;
/** A due run waiting longer than this means the queue isn't keeping up. */
const QUEUE_LAG_DEGRADED_MS = 10 * 60_000;

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return Response.json({ ok: false, error: "database_unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const now = Date.now();
  const worker = getWorkerStatus();
  const workerExpected = process.env.RUN_WORKER_IN_APP !== "false";
  const reasons: string[] = [];
  let queue: { depth: number | null; oldestQueuedAgeSec: number | null } = { depth: null, oldestQueuedAgeSec: null };
  try {
    const due = { state: { in: ["queued", "retry_scheduled"] }, runAfter: { lte: new Date(now) } };
    const [depth, oldest] = await Promise.all([
      db.workflowRun.count({ where: due }),
      db.workflowRun.findFirst({ where: due, orderBy: { runAfter: "asc" }, select: { runAfter: true } }),
    ]);
    const ageMs = oldest ? Math.max(0, now - oldest.runAfter.getTime()) : null;
    queue = { depth, oldestQueuedAgeSec: ageMs === null ? null : Math.round(ageMs / 1000) };
    if (ageMs !== null && ageMs > QUEUE_LAG_DEGRADED_MS) reasons.push("queue_lagging");
  } catch {
    reasons.push("queue_stats_unavailable");
  }

  const lastTickMs = worker.lastTickAt ? Date.parse(worker.lastTickAt) : null;
  if (workerExpected) {
    if (!worker.started) reasons.push("worker_not_started");
    else if (worker.stopping) reasons.push("worker_stopping");
    else if (lastTickMs === null || now - lastTickMs > WORKER_STALE_MS) reasons.push("worker_stalled");
  }

  return Response.json(
    {
      ok: true,
      degraded: reasons.length > 0,
      ...(reasons.length ? { reasons } : {}),
      worker: {
        inProcess: workerExpected,
        started: worker.started,
        lastTickAt: worker.lastTickAt,
        lastTickAgeSec: lastTickMs === null ? null : Math.round((now - lastTickMs) / 1000),
        activeRuns: worker.active,
      },
      queue,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
