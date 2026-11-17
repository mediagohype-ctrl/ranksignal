// Server side of ./run-state.ts: reads the latest AI check and its queue row. Every query is tenant-scoped.
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email/send";
import { wantsEmail } from "@/lib/dashboard/project-schema";
import { AI_CHECK_NONE, AI_RUN_DONE, AI_RUN_IN_FLIGHT, aiCheckStateOf, type AiCheckStatus } from "./run-state";

/** The latest AI check of a website, in customer terms. */
export async function getAiCheckState(projectId: string, orgId: string, now = new Date()): Promise<AiCheckStatus> {
  const where = { organizationId: orgId, projectId };
  const run = await db.visibilityRun.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, collected: true, sampleSize: true, workflowRunId: true },
  });
  if (!run) return AI_CHECK_NONE;
  const [wf, earlier] = await Promise.all([
    AI_RUN_IN_FLIGHT.includes(run.status) && run.workflowRunId
      ? db.workflowRun.findUnique({ where: { id: run.workflowRunId }, select: { state: true, runAfter: true, input: true } })
      : null,
    db.visibilityRun.findFirst({ where: { ...where, status: { in: AI_RUN_DONE }, NOT: { id: run.id } }, select: { id: true } }),
  ]);
  return aiCheckStateOf(run, wf, { now, hasEarlierDone: !!earlier });
}

/**
 * Whether "We'll email you when it's done" is a promise we can keep: email is set up and this website's emails
 * are on (the "Your AI results are ready" email goes out from src/lib/notifications/dispatch.ts).
 */
export function aiCheckEmailsOn(projectSettings: unknown): boolean {
  return isEmailConfigured() && wantsEmail(projectSettings, null);
}
