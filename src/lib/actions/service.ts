// Approval & execution request service (blueprint §2.2 steps 8–11, §6.2).
// Approvals bind to the exact draft hash; any edit invalidates them. Every decision is audit-logged.
import { Prisma, type Action } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { enqueue } from "@/lib/jobs/queue";
import { isEnabled } from "@/lib/flags";
import type { ProposedChange, Role, SessionContext } from "@/lib/types";
import { POLICY_VERSION } from "@/lib/policy/engine";
import { buildManualInstructions } from "@/lib/connectors/manual";
import { capabilitiesOf, changeOf, checkExecutionGate, evaluatePolicy, hashOf, targetOf } from "@/lib/actions/gate";

export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
const EDITABLE = ["proposed", "awaiting_approval", "approved", "rejected", "expired", "blocked", "failed"];

async function loadAction(actionId: string, orgId: string) {
  const action = await db.action.findFirst({ where: { id: actionId, organizationId: orgId } });
  if (!action) throw new HttpError(404, "not_found", "Action not found");
  return action;
}

function link(a: Pick<Action, "projectId" | "id">) {
  return `/app/projects/${a.projectId}/actions?focus=${a.id}`;
}

/** Create a pending Approval for the action's current draft hash and notify approvers. */
export async function requestApproval(actionId: string, session: SessionContext | { organizationId: string; userId?: null }, opts: { ttlMs?: number } = {}) {
  const action = await loadAction(actionId, session.organizationId);
  const hash = hashOf(action);
  const approval = await db.approval.create({
    data: {
      organizationId: action.organizationId,
      actionId: action.id,
      requestedBy: session.userId ?? null,
      draftHash: hash,
      decision: "pending",
      expiresAt: new Date(Date.now() + (opts.ttlMs ?? APPROVAL_TTL_MS)),
    },
  });
  await db.action.update({ where: { id: action.id }, data: { status: "awaiting_approval", draftHash: hash } });
  await db.notification.create({
    data: {
      organizationId: action.organizationId,
      type: "approval_requested",
      title: `Approval requested: ${action.type.replace(/_/g, " ")}`,
      body: `Class ${action.riskClass} change${targetOf(action)?.url ? ` on ${targetOf(action)!.url}` : ""} is waiting for review.`,
      link: link(action),
    },
  });
  await writeAuditLog({
    organizationId: action.organizationId,
    actorId: session.userId ?? null,
    actorType: session.userId ? "user" : "system",
    action: "action.approval_requested",
    resourceType: "action",
    resourceId: action.id,
    after: { approvalId: approval.id, draftHash: hash, expiresAt: approval.expiresAt.toISOString() },
  });
  return approval;
}

export async function approve(actionId: string, body: { draftHash: string; comments?: string }, session: SessionContext) {
  const action = await loadAction(actionId, session.organizationId);
  if (action.status !== "awaiting_approval") throw new HttpError(409, "invalid_state", `Action is ${action.status}, not awaiting approval`);
  if (ROLE_RANK[session.role] < ROLE_RANK.member) throw new HttpError(403, "forbidden", "Viewers cannot approve");
  if (action.riskClass === "C" && ROLE_RANK[session.role] < ROLE_RANK.admin) {
    throw new HttpError(403, "forbidden", "Class C changes require an admin or owner to approve");
  }
  if (action.riskClass === "D" || action.policyDecision === "blocked") throw new HttpError(409, "policy_blocked", "Blocked actions cannot be approved");

  const current = hashOf(action);
  if (body.draftHash !== current || (action.draftHash && action.draftHash !== current)) {
    await writeAuditLog({
      organizationId: action.organizationId, actorId: session.userId, action: "action.approval_rejected_stale",
      resourceType: "action", resourceId: action.id, after: { submitted: body.draftHash, current },
    });
    throw new HttpError(409, "stale_draft", "The draft changed since you reviewed it. Reload and review the current version.", { currentHash: current });
  }

  const pending = await db.approval.findFirst({
    where: { actionId: action.id, organizationId: action.organizationId, decision: "pending", draftHash: current },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  if (!pending) throw new HttpError(409, "no_pending_approval", "No pending approval request for this draft");
  if (pending.expiresAt <= now) {
    await db.approval.update({ where: { id: pending.id }, data: { decision: "expired", decidedAt: now } });
    await db.action.update({ where: { id: action.id }, data: { status: "expired" } });
    await writeAuditLog({
      organizationId: action.organizationId, actorId: session.userId, action: "action.approval_expired",
      resourceType: "action", resourceId: action.id, after: { approvalId: pending.id },
    });
    throw new HttpError(409, "approval_expired", "This approval request has expired. Request a new review.");
  }

  const approval = await db.approval.update({
    where: { id: pending.id },
    data: { decision: "approved", approverId: session.userId, decidedAt: now, comments: body.comments ?? null },
  });
  const updated = await db.action.update({ where: { id: action.id }, data: { status: "approved" } });
  await writeAuditLog({
    organizationId: action.organizationId, actorId: session.userId, action: "action.approved",
    resourceType: "action", resourceId: action.id,
    before: { status: action.status }, after: { status: "approved", approvalId: approval.id, draftHash: current, riskClass: action.riskClass },
  });
  return { action: updated, approval };
}

export async function reject(actionId: string, reason: string | undefined, session: SessionContext) {
  const action = await loadAction(actionId, session.organizationId);
  if (!["awaiting_approval", "approved", "proposed", "blocked", "expired"].includes(action.status)) {
    throw new HttpError(409, "invalid_state", `Action is ${action.status} and cannot be rejected`);
  }
  const now = new Date();
  await db.approval.updateMany({
    where: { actionId: action.id, organizationId: action.organizationId, decision: { in: ["pending", "approved"] } },
    data: { decision: "rejected", approverId: session.userId, decidedAt: now, comments: reason ?? null },
  });
  const updated = await db.action.update({ where: { id: action.id }, data: { status: "rejected" } });
  await writeAuditLog({
    organizationId: action.organizationId, actorId: session.userId, action: "action.rejected",
    resourceType: "action", resourceId: action.id, before: { status: action.status }, after: { status: "rejected", reason: reason ?? null },
  });
  return updated;
}

/** Edit the draft text: recompute policy + hash, invalidate every pending/approved approval. */
export async function editDraft(actionId: string, after: string, session: SessionContext) {
  const action = await loadAction(actionId, session.organizationId);
  if (!EDITABLE.includes(action.status)) throw new HttpError(409, "invalid_state", `Action is ${action.status} and cannot be edited`);
  const prev = changeOf(action);
  if (!prev) throw new HttpError(409, "not_editable", "This action has no editable draft");
  const nextChange: ProposedChange = { ...prev, after };

  const project = await db.project.findFirst({ where: { id: action.projectId, organizationId: action.organizationId } });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  const integration = action.integrationId
    ? await db.integration.findFirst({ where: { id: action.integrationId, organizationId: action.organizationId } })
    : null;
  const policy = evaluatePolicy({ ...action, proposedChange: nextChange as unknown as Prisma.JsonValue }, project, integration ? capabilitiesOf(integration) : undefined);
  const hash = hashOf({ type: action.type, target: action.target, proposedChange: nextChange as unknown as Prisma.JsonValue, policyVersion: POLICY_VERSION });

  const invalidated = await db.approval.updateMany({
    where: { actionId: action.id, organizationId: action.organizationId, decision: { in: ["pending", "approved"] } },
    data: { decision: "invalidated", decidedAt: new Date(), comments: "Draft edited" },
  });
  const status = policy.decision === "blocked" ? "blocked" : "awaiting_approval";
  const updated = await db.action.update({
    where: { id: action.id },
    data: {
      proposedChange: nextChange as unknown as Prisma.InputJsonValue,
      draftHash: hash,
      policyVersion: POLICY_VERSION,
      riskClass: policy.riskClass,
      // A human edited the draft, so it is always re-reviewed even if the class would auto-execute.
      policyDecision: policy.decision === "auto_execute" ? "approval_required" : policy.decision,
      policyReason: policy.decision === "auto_execute" ? `${policy.reason} (edited draft requires review)` : policy.reason,
      status,
    },
  });
  await writeAuditLog({
    organizationId: action.organizationId, actorId: session.userId, action: "action.draft_edited",
    resourceType: "action", resourceId: action.id,
    before: { after: prev.after, draftHash: action.draftHash, status: action.status },
    after: { after, draftHash: hash, status, invalidatedApprovals: invalidated.count, riskClass: policy.riskClass },
  });
  if (status === "awaiting_approval") await requestApproval(action.id, session);
  return (await db.action.findFirst({ where: { id: action.id, organizationId: action.organizationId } })) ?? updated;
}

/** Backend re-check then enqueue the execute job (idempotent on action + exact hash). */
export async function requestExecution(actionId: string, session: SessionContext | { organizationId: string; userId?: null }) {
  const action = await loadAction(actionId, session.organizationId);
  const executable = action.status === "approved" || (action.policyDecision === "auto_execute" && ["proposed", "failed"].includes(action.status));
  if (!executable) throw new HttpError(409, "invalid_state", `Action is ${action.status} and cannot be executed`);

  if (!action.integrationId) {
    throw new HttpError(409, "manual_required", "No connected integration can apply this change. Use the manual instructions.", {
      instructions: buildManualInstructions({ type: action.type, target: targetOf(action), proposedChange: changeOf(action), rationale: action.rationale }),
    });
  }
  const gate = await checkExecutionGate(action);
  if (!gate.ok) {
    await writeAuditLog({
      organizationId: action.organizationId, actorId: session.userId ?? null, actorType: session.userId ? "user" : "system",
      action: "action.execution_denied", resourceType: "action", resourceId: action.id, after: { code: gate.code, message: gate.message },
    });
    throw new HttpError(409, gate.code, gate.message);
  }
  const run = await enqueue({
    kind: "execute_action",
    organizationId: action.organizationId,
    projectId: action.projectId,
    input: { actionId: action.id, draftHash: gate.hash },
    idempotencyKey: `exec:${action.id}:${gate.hash}`,
  });
  await writeAuditLog({
    organizationId: action.organizationId, actorId: session.userId ?? null, actorType: session.userId ? "user" : "system",
    action: "action.execution_requested", resourceType: "action", resourceId: action.id,
    after: { workflowRunId: run.id, draftHash: gate.hash, riskClass: gate.policy.riskClass },
  });
  return run;
}

export async function requestRollback(actionId: string, session: SessionContext) {
  const action = await loadAction(actionId, session.organizationId);
  if (!["succeeded", "succeeded_with_warnings", "rollback_failed", "failed"].includes(action.status)) {
    throw new HttpError(409, "invalid_state", `Action is ${action.status}; nothing to roll back`);
  }
  if (action.riskClass === "C" && ROLE_RANK[session.role] < ROLE_RANK.admin) {
    throw new HttpError(403, "forbidden", "Rolling back class C changes requires an admin or owner");
  }
  const execution = await db.actionExecution.findFirst({
    where: { actionId: action.id, organizationId: action.organizationId, beforeState: { not: Prisma.DbNull } },
    orderBy: { startedAt: "desc" },
  });
  if (!execution) throw new HttpError(409, "no_before_state", "No captured before-state to restore");
  const org = await db.organization.findUnique({ where: { id: action.organizationId } });
  if (!org?.publishingEnabled || !(await isEnabled("global.publishing"))) {
    throw new HttpError(409, "publishing_paused", "Publishing is paused; rollback writes are blocked too");
  }
  const run = await enqueue({
    kind: "rollback",
    organizationId: action.organizationId,
    projectId: action.projectId,
    input: { actionId: action.id, executionId: execution.id },
    idempotencyKey: `rollback:${execution.id}:${action.status}`,
  });
  await db.action.update({ where: { id: action.id }, data: { status: "rollback_pending" } });
  await writeAuditLog({
    organizationId: action.organizationId, actorId: session.userId, action: "action.rollback_requested",
    resourceType: "action", resourceId: action.id, after: { workflowRunId: run.id, executionId: execution.id },
  });
  return run;
}
