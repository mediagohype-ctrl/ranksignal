// Registers every workflow handler. Each module owns its handler file.
import { registerHandler, startWorker } from "@/lib/jobs/queue";
import { crawlJob } from "@/lib/crawler/job";
import { visibilityJob } from "@/lib/visibility/job";
import { analyzeJob } from "@/lib/recommendations/job";
import { executeActionJob, rollbackJob } from "@/lib/actions/job";
import { auditDepthJob } from "@/lib/pagespeed/job";
import { indexNowJob } from "@/lib/indexnow-customer/job";
import { rankTrackerJob } from "@/lib/rank-tracker/job";
import { backlinksRefreshJob } from "@/lib/backlinks/job";
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
  registerHandler("audit_depth", auditDepthJob);
  registerHandler("indexnow", indexNowJob);
  registerHandler("rank_tracker", rankTrackerJob);
  registerHandler("backlinks_refresh", backlinksRefreshJob);
}

export function bootWorker() {
  registerAllHandlers();
  startWorker();
  // Recurring scans, interrupted-run recovery and completion notifications (one instance via advisory lock).
  startScheduler();
}

export { enqueue } from "@/lib/jobs/queue";
