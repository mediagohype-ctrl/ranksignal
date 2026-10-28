// /api/admin/jobs/[id]
//   GET  — workflow run with its events
//   POST {action: "retry"|"cancel", reason} — retry a failed run (→ queued, runAfter now, attempts reset)
//        or cancel a queued / retry_scheduled run. Both audit-logged and recorded as workflow events.
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["retry", "cancel"]), reason: reasonSchema });

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireStaffApi();
  const { id } = await params;
  const item = await db.workflowRun.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "asc" }, take: 500 } } });
  if (!item) throw new HttpError(404, "not_found", "Job not found");
  return json({ item });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const { action, reason } = await parseBody(req, schema);
  const run = await db.workflowRun.findUnique({
    where: { id },
    select: { id: true, organizationId: true, kind: true, state: true, attempts: true, error: true, errorClass: true },
  });
  if (!run) throw new HttpError(404, "not_found", "Job not found");

  const from = action === "retry" ? ["failed"] : ["queued", "retry_scheduled"];
  const to = action === "retry" ? "queued" : "cancelled";
  // Conditional update: only applies if the run is still in an allowed state (no race with the worker).
  const res = await db.workflowRun.updateMany({
    where: { id, state: { in: from } },
    data:
      action === "retry"
        ? { state: to, runAfter: new Date(), attempts: 0, lockedAt: null, lockedBy: null, error: null, errorClass: null }
        : { state: to, lockedAt: null, lockedBy: null },
  });
  if (res.count !== 1) {
    throw new HttpError(
      409,
      "invalid_state",
      action === "retry" ? `Only failed jobs can be retried (this one is ${run.state}).` : `Only queued jobs can be cancelled (this one is ${run.state}).`,
    );
  }
  await db.workflowEvent.create({
    data: {
      workflowRunId: id,
      name: `${run.kind}.${action === "retry" ? "retried_by_staff" : "cancelled_by_staff"}`,
      fromState: run.state,
      toState: to,
      data: { staffEmail: staff.user.email, reason },
    },
  });
  await staffAudit(staff, req, {
    organizationId: run.organizationId,
    action: action === "retry" ? "admin.job_retried" : "admin.job_cancelled",
    resourceType: "workflow_run",
    resourceId: id,
    before: { state: run.state, attempts: run.attempts, error: run.error, errorClass: run.errorClass },
    after: { state: to },
    reason,
  });
  return json({ item: { id, state: to } });
});
