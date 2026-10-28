// Registers every workflow handler. Each module owns its handler file.
import { registerHandler, startWorker } from "@/lib/jobs/queue";
import { crawlJob } from "@/lib/crawler/job";
import { visibilityJob } from "@/lib/visibility/job";
import { analyzeJob } from "@/lib/recommendations/job";
import { executeActionJob, rollbackJob } from "@/lib/actions/job";
import { startScheduler } from "@/lib/jobs/scheduler";

let registered = false;

export function registerAllHandlers() {
  if (registered) return;
  registered = true;
  registerHandler("crawl", crawlJob);
  registerHandler("visibility", visibilityJob);
  registerHandler("analyze", analyzeJob);
  registerHandler("execute_action", executeActionJob);
  registerHandler("rollback", rollbackJob);
}

export function bootWorker() {
  registerAllHandlers();
  startWorker();
  // Recurring scans, interrupted-run recovery and completion notifications (one instance via advisory lock).
  startScheduler();
}

export { enqueue } from "@/lib/jobs/queue";
