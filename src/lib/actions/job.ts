// Execute + rollback workflow handlers (blueprint §2.2 steps 11–14, §6.2 safeguards, in order):
// reload → re-verify policy/approval hash/kill switches → idempotency → before-state → versioned
// patch → validate → rollback on failed validation. Every step emits a workflow event.
import { Prisma, type Action } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { isEnabled } from "@/lib/flags";
import type { JobContext, JobHandler } from "@/lib/jobs/queue";
import { JobError, type Connector, type ConnectorResource } from "@/lib/types";
import { getConnectorForIntegration } from "@/lib/connectors/registry";
import { buildManualInstructions } from "@/lib/connectors/manual";
import { changeOf, checkExecutionGate, targetOf } from "@/lib/actions/gate";

/** errorClass the queue maps to state failed + "needs_review" + staff notification (never retried). */
const NEEDS_REVIEW = "needs_review";
export class NeedsReviewError extends Error {
  readonly errorClass = NEEDS_REVIEW;
}

type ResolvableConnector = Connector & { resolveResourceId?: (url: string) => Promise<string | null> };

const norm = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function audit(action: Action, name: string, after: Record<string, unknown>) {
  await writeAuditLog({
    organizationId: action.organizationId, actorType: "system", action: name,
    resourceType: "action", resourceId: action.id, after,
  });
}

async function notify(action: Action, type: string, title: string, body: string) {
  await db.notification.create({
    data: { organizationId: action.organizationId, type, title, body, link: `/app/projects/${action.projectId}/actions?focus=${action.id}` },
  });
}

async function loadConnector(action: Action): Promise<ResolvableConnector> {
  try {
    return await getConnectorForIntegration(action.integrationId!, action.organizationId);
  } catch (e) {
    throw new JobError(`connector_unavailable: ${e instanceof Error ? e.message : "unknown"}`, "permanent");
  }
}

export const executeActionJob: JobHandler = async (ctx) => {
  const { actionId, draftHash: approvedHash } = ctx.run.input as { actionId?: string; draftHash?: string };
  if (!actionId || !approvedHash) throw new JobError("invalid_input", "permanent");
  const orgId = ctx.run.organizationId;

  // 1. Reload the action (never trust queued payload beyond ids + hash).
  const action = await db.action.findFirst({ where: { id: actionId, organizationId: orgId } });
  if (!action) throw new JobError("action_not_found", "permanent");
  const idempotencyKey = `exec:${action.id}:${approvedHash}`;

  // 2. Idempotency: a succeeded execution for this exact draft is returned, never re-applied.
  const existing = await db.actionExecution.findUnique({ where: { idempotencyKey } });
  if (existing && existing.result === "success") {
    await ctx.event("action.execution_deduplicated", { executionId: existing.id });
    return { executionId: existing.id, deduplicated: true };
  }
  if (existing && existing.result !== "pending") {
    await ctx.event("action.execution_deduplicated", { executionId: existing.id, result: existing.result });
    return { executionId: existing.id, deduplicated: true, result: existing.result };
  }

  const blocked = async (code: string, message: string, extra: Record<string, unknown> = {}) => {
    await ctx.transition("blocked", "action.execution_blocked", { code, message, ...extra });
    await audit(action, "action.execution_blocked", { code, message });
    return { blocked: true, code };
  };

  const change = changeOf(action);
  const target = targetOf(action);
  if (!change) return blocked("no_draft", "Action has no proposed change");
  if (!action.integrationId) {
    const instructions = buildManualInstructions({ type: action.type, target, proposedChange: change, rationale: action.rationale });
    await notify(action, "job_failed", "Manual change required", instructions.slice(0, 1000));
    return blocked("manual_required", "No integration can apply this change", { instructions });
  }

  // 3. Re-verify policy (with LIVE connector capabilities), approval hash, kill switches.
  const connector = await loadConnector(action);
  const caps = connector.getCapabilities();
  const gate = await checkExecutionGate(action, { capabilities: caps });
  if (!gate.ok) return blocked(gate.code, gate.message);
  if (gate.hash !== approvedHash) return blocked("stale_draft", "Draft changed after the execution was requested");
  const allowedStatus = ["approved", "executing", "failed", "proposed"];
  if (!allowedStatus.includes(action.status)) return blocked("invalid_state", `Action is ${action.status}`);

  // 4. Resolve the CMS resource.
  let resourceId = target?.resourceId ?? null;
  if (!resourceId && target?.url && connector.resolveResourceId) resourceId = await connector.resolveResourceId(target.url);
  if (!resourceId) {
    await db.action.update({ where: { id: action.id }, data: { status: "failed" } });
    await ctx.transition("failed", "action.execution_failed", { error: "resource_not_found" });
    const instructions = buildManualInstructions({ type: action.type, target, proposedChange: change, rationale: action.rationale });
    await notify(action, "job_failed", "Could not locate page in CMS", `The connector could not map ${target?.url ?? "the target"} to a CMS resource.\n\n${instructions}`.slice(0, 1000));
    await audit(action, "action.execution_failed", { error: "resource_not_found" });
    return { failed: true, error: "resource_not_found" };
  }

  // 5. Pending execution from an interrupted attempt: applyPatch may or may not have reached the site, so it
  //    is NEVER called again (a blind retry could double-apply or overwrite a newer edit). Read the live
  //    resource: if it already equals the intended "after", finish via validation; otherwise stop and flag
  //    the run for human review.
  let alreadyApplied = false;
  let execution = existing;
  let before: ConnectorResource | null = (existing?.beforeState as ConnectorResource | null) ?? null;
  if (existing) {
    let live: ConnectorResource | null = null;
    try {
      live = await connector.getResource(resourceId);
    } catch {
      live = null;
    }
    alreadyApplied = !!live && norm(live.fields[change.field]) === norm(change.after);
    await ctx.event("action.execution_resumed", { executionId: existing.id, alreadyApplied });
    if (!alreadyApplied) {
      const reason = live ? "live_value_differs_from_intended" : "live_state_unavailable";
      await db.actionExecution.update({
        where: { id: existing.id },
        data: { result: "failure", rollbackStatus: "manual_required", resultDetail: json({ error: NEEDS_REVIEW, reason }), finishedAt: new Date() },
      });
      await db.action.update({ where: { id: action.id }, data: { status: "failed" } });
      await notify(
        action, "job_failed", "Change needs review",
        "An earlier attempt to apply this change was interrupted and we could not confirm whether it reached your site. " +
          "Nothing was retried. Our team will check the page and follow up.",
      );
      await audit(action, "action.execution_needs_review", { executionId: existing.id, reason });
      throw new NeedsReviewError(`Interrupted execution could not be verified (${reason})`);
    }
  }

  // 6. Capture before-state.
  if (!before) {
    before = await connector.getResource(resourceId);
    if (!before) throw new JobError("resource_not_found_in_cms", "permanent");
  }
  if (!execution) {
    try {
      execution = await db.actionExecution.create({
        data: {
          organizationId: orgId, actionId: action.id, connector: connector.id, idempotencyKey,
          beforeState: json(before), expectedVersion: before.version ?? null, result: "pending",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new JobError("concurrent_execution_in_progress", "transient");
      }
      throw e;
    }
  }

  await db.action.update({ where: { id: action.id }, data: { status: "executing" } });
  await ctx.transition("executing", "action.execution_started", { executionId: execution.id, resourceId, riskClass: gate.policy.riskClass });
  await audit(action, "action.execution_started", { executionId: execution.id, resourceId, draftHash: approvedHash });

  // 7. Apply with optimistic concurrency.
  if (!alreadyApplied) {
    const res = await connector.applyPatch(resourceId, change, execution.expectedVersion ?? undefined, idempotencyKey);
    if (!res.ok) {
      const manual = res.error === "manual_required";
      await db.actionExecution.update({
        where: { id: execution.id },
        data: { result: "failure", resultDetail: json({ error: res.error, ...(res.detail ?? {}) }), rollbackStatus: "not_needed", finishedAt: new Date() },
      });
      await db.action.update({ where: { id: action.id }, data: { status: manual ? "approved" : "failed" } });
      await ctx.transition(manual ? "blocked" : "failed", "action.execution_failed", { error: res.error });
      await notify(
        action, "job_failed",
        manual ? "Manual change required" : "Change could not be applied",
        manual
          ? String(res.detail?.instructions ?? "Apply this change manually.").slice(0, 1000)
          : res.error === "conflict"
            ? "The page was edited in the CMS after review. Re-run analysis to refresh the draft."
            : `The connector returned: ${res.error}. Nothing was changed.`,
      );
      await audit(action, "action.execution_failed", { executionId: execution.id, error: res.error });
      return { executionId: execution.id, ok: false, error: res.error };
    }
    await db.actionExecution.update({ where: { id: execution.id }, data: { resultDetail: json({ newVersion: res.newVersion, ...(res.detail ?? {}) }) } });
  }

  // 8. Validate.
  await ctx.transition("validating", "action.validating", { executionId: execution.id });
  const v = await connector.validateResource(resourceId, change);
  await db.actionExecution.update({ where: { id: execution.id }, data: { validation: v.status } });

  if (v.status !== "failed") {
    const status = v.status === "passed" ? "succeeded" : "succeeded_with_warnings";
    await db.actionExecution.update({ where: { id: execution.id }, data: { result: "success", rollbackStatus: "not_needed", finishedAt: new Date() } });
    await db.action.update({ where: { id: action.id }, data: { status } });
    await ctx.event("action.validation_passed", { status: v.status, detail: v.detail });
    await ctx.transition(status, "action.execution_succeeded", { executionId: execution.id });
    await notify(action, "change_completed", "Change applied", `${action.type.replace(/_/g, " ")} applied${target?.url ? ` to ${target.url}` : ""}. ${v.detail}`);
    await audit(action, "action.execution_succeeded", { executionId: execution.id, validation: v.status });
    // Re-measurement is scheduled from the UI; record the hand-off. Outcomes are measured, not assumed causal.
    await ctx.event("action.remeasure_scheduled", { actionId: action.id, url: target?.url ?? null });
    return { executionId: execution.id, status };
  }

  // 9. Validation failed → rollback if supported, else manual recovery.
  await ctx.event("action.validation_failed", { detail: v.detail });
  await db.action.update({ where: { id: action.id }, data: { status: "rollback_pending" } });
  await db.actionExecution.update({ where: { id: execution.id }, data: { result: "failure", rollbackStatus: "pending" } });
  await ctx.transition("rollback_pending", "action.rollback_pending", { executionId: execution.id });
  const outcome = await performRollback(ctx, action, connector, resourceId, before, execution.id);
  return { executionId: execution.id, status: outcome };
};

async function performRollback(
  ctx: JobContext, action: Action, connector: Connector, resourceId: string, before: ConnectorResource, executionId: string,
): Promise<"rolled_back" | "rollback_failed"> {
  if (!connector.getCapabilities().rollback) {
    await db.actionExecution.update({ where: { id: executionId }, data: { rollbackStatus: "manual_required", finishedAt: new Date() } });
    await db.action.update({ where: { id: action.id }, data: { status: "rollback_failed" } });
    await ctx.transition("rollback_failed", "action.rollback_failed", { reason: "connector_cannot_rollback" });
    await notify(action, "job_failed", "Manual recovery required", "Validation failed and this connector cannot roll back automatically. Restore the previous values shown in the action's before-state.");
    await audit(action, "action.rollback_failed", { executionId, reason: "manual_required" });
    return "rollback_failed";
  }
  await ctx.event("action.rollback_started", { executionId });
  let r;
  try {
    r = await connector.rollback(resourceId, before);
  } catch (e) {
    r = { ok: false, error: e instanceof Error ? e.message : "rollback_error" };
  }
  if (r.ok) {
    await db.actionExecution.update({ where: { id: executionId }, data: { rollbackStatus: "rolled_back", finishedAt: new Date() } });
    await db.action.update({ where: { id: action.id }, data: { status: "rolled_back" } });
    await ctx.transition("rolled_back", "action.rolled_back", { executionId });
    await notify(action, "change_completed", "Change rolled back", "The previous version was restored.");
    await audit(action, "action.rolled_back", { executionId });
    return "rolled_back";
  }
  await db.actionExecution.update({ where: { id: executionId }, data: { rollbackStatus: "failed", finishedAt: new Date(), resultDetail: json({ rollbackError: r.error }) } });
  await db.action.update({ where: { id: action.id }, data: { status: "rollback_failed" } });
  await ctx.transition("rollback_failed", "action.rollback_failed", { error: r.error });
  await notify(action, "job_failed", "Rollback failed — manual recovery required", `Rollback error: ${r.error}. Restore the before-state manually.`);
  await audit(action, "action.rollback_failed", { executionId, error: r.error });
  return "rollback_failed";
}

export const rollbackJob: JobHandler = async (ctx) => {
  const { actionId, executionId } = ctx.run.input as { actionId?: string; executionId?: string };
  if (!actionId) throw new JobError("invalid_input", "permanent");
  const orgId = ctx.run.organizationId;
  const action = await db.action.findFirst({ where: { id: actionId, organizationId: orgId } });
  if (!action) throw new JobError("action_not_found", "permanent");
  const execution = await db.actionExecution.findFirst({
    where: { actionId, organizationId: orgId, ...(executionId ? { id: executionId } : {}), beforeState: { not: Prisma.DbNull } },
    orderBy: { startedAt: "desc" },
  });
  if (!execution) throw new JobError("no_before_state", "permanent");
  if (execution.rollbackStatus === "rolled_back") return { executionId: execution.id, deduplicated: true };
  if (!action.integrationId) throw new JobError("no_integration", "permanent");

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org?.publishingEnabled || !(await isEnabled("global.publishing"))) {
    await ctx.transition("blocked", "action.rollback_blocked", { reason: "publishing_paused" });
    return { blocked: true };
  }
  const before = execution.beforeState as unknown as ConnectorResource;
  const connector = await loadConnector(action);
  await ctx.transition("executing", "action.rollback_started", { executionId: execution.id });
  await audit(action, "action.rollback_started", { executionId: execution.id });
  const status = await performRollback(ctx, action, connector, before.id, before, execution.id);
  return { executionId: execution.id, status };
};

