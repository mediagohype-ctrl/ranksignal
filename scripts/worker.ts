// Standalone worker for production: run alongside `next start` with RUN_WORKER_IN_APP=false.
// Drains gracefully on SIGTERM (same policy as src/instrumentation.ts): scans are released back to the
// queue, website-change runs finish or are flagged needs_review.
import { assertProductionEnv } from "@/lib/env";
import { bootWorker } from "@/lib/jobs";
import { shutdownWorker } from "@/lib/jobs/queue";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

assertProductionEnv();
bootWorker();
log.info("worker.started");

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info("process.signal", { signal });
  try {
    await shutdownWorker({ graceMs: 20_000, siteWriteGraceMs: 20_000 });
  } catch (err) {
    log.error("process.shutdown_failed", { err });
  }
  await db.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));
