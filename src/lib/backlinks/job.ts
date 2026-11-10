// "backlinks_refresh" job: the scheduled (weekly / monthly per plan) backlink refresh for one project.
// Enqueued by enqueueDueBacklinkRefreshes() from the scheduler tick.
import { JobError } from "@/lib/types";
import type { JobHandler } from "@/lib/jobs/queue";
import { runScheduledRefresh } from "./service";

export const backlinksRefreshJob: JobHandler = async (ctx) => {
  const projectId = typeof ctx.run.input.projectId === "string" ? ctx.run.input.projectId : ctx.run.projectId;
  if (!projectId) throw new JobError("backlinks_refresh: missing projectId", "permanent");
  await ctx.transition("running", "backlinks.refresh.started");
  return runScheduledRefresh(ctx.run.organizationId, projectId);
};
