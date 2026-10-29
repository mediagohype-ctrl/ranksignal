// Approval & execution request service (blueprint §2.2 steps 8–11, §6.2).
// Approvals bind to the exact draft hash; any edit invalidates them. Every decision is audit-logged.
import { Prisma, type Action } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
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

type ActorSession = SessionContext | { organizationId: string; userId?: null };

/** Audit actor for a user/staff session, or "system" for background jobs (no userId). */
function actorOf(session: ActorSession): { actorId: string | null; actorType: "user" | "staff" | "system" } {
  return isUserSession(session) ? auditActorFromSession(session) : { actorId: null, actorType: "system" };
}

function isUserSession(session: ActorSession): session is SessionContext {
  return Boolean(session.userId) && "role" in session;
}

/** Owners/admins with an active membership (staff in support mode are not counted: they are not the business). */
export async function countOrgApprovers(organizationId: string): Promise<number> {
  return db.membership.count({ where: { organizationId, status: "active", role: { in: ["owner", "admin"] } } });
}

/** The user who last edited this action's draft text (from the audit trail), if any. */
async function lastDraftEditor(action: Pick<Action, "id" | "organizationId">): Promise<string | null> {
  const row = await db.auditLog.findFirst({
    where: { organizationId: action.organizationId, resourceType: "action", resourceId: action.id, action: "action.draft_edited" },
    orderBy: { createdAt: "desc" },
    select: { actorId: true },
  });
  return row?.actorId ?? null;
}

function link(a: Pick<Action, "projectId" | "id">) {
  return `/app/projects/${a.projectId}/actions?focus=${a.id}`;
}

/** Create a pending Approval for the action's current draft hash and notify approvers. */
export async function requestApproval(actionId: string, session: ActorSession, opts: { ttlMs?: number } = {}) {
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
    ...actorOf(session),
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
      organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.approval_rejected_stale",
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
      organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.approval_expired",
      resourceType: "action", resourceId: action.id, after: { approvalId: pending.id },
    });
    throw new HttpError(409, "approval_expired", "This approval request has expired. Request a new review.");
  }

  // Separation of duties: whoever requested the review or last edited the draft can't also approve it. Solo
  // businesses (a single owner/admin) may self-approve as that owner/admin; it is flagged in the audit trail.
  const editor = await lastDraftEditor(action);
  const involved = pending.requestedBy === session.userId || editor === session.userId;
  let selfApproved = false;
  if (involved) {
    const soloAdmin =
      !session.staffMode && ROLE_RANK[session.role] >= ROLE_RANK.admin && (await countOrgApprovers(action.organizationId)) <= 1;
    if (!soloAdmin) {
      await writeAuditLog({
        organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.approval_denied_self",
        resourceType: "action", resourceId: action.id, after: { approvalId: pending.id, requestedBy: pending.requestedBy, lastEditor: editor },
      });
      throw new HttpError(403, "separation_of_duties", "You requested or edited this change, so another teammate needs to approve it.");
    }
    selfApproved = true;
  }

  const approval = await db.approval.update({
    where: { id: pending.id },
    data: { decision: "approved", approverId: session.userId, decidedAt: now, comments: body.comments ?? null },
  });
  const updated = await db.action.update({ where: { id: action.id }, data: { status: "approved" } });
  await writeAuditLog({
    organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.approved",
    resourceType: "action", resourceId: action.id,
    before: { status: action.status },
    after: {
      status: "approved", approvalId: approval.id, draftHash: current, riskClass: action.riskClass,
      ...(selfApproved ? { self_approved: true, selfApprovalReason: "sole_owner_or_admin" } : {}),
    },
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
    organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.rejected",
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
    organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.draft_edited",
    resourceType: "action", resourceId: action.id,
    before: { after: prev.after, draftHash: action.draftHash, status: action.status },
    after: { after, draftHash: hash, status, invalidatedApprovals: invalidated.count, riskClass: policy.riskClass },
  });
  if (status === "awaiting_approval") await requestApproval(action.id, session);
  return (await db.action.findFirst({ where: { id: action.id, organizationId: action.organizationId } })) ?? updated;
}

/**
 * Backend re-check then enqueue the execute job (idempotent on action + exact hash).
 * People: admin/owner (or staff support mode) only. Background jobs (no userId) may request auto-execution.
 */
export async function requestExecution(actionId: string, session: ActorSession) {
  if (session.userId && (!isUserSession(session) || (ROLE_RANK[session.role] < ROLE_RANK.admin && !session.staffMode))) {
    throw new HttpError(403, "forbidden", "Only an admin or owner can publish changes to the site");
  }
  const action = await loadAction(actionId, session.organizationId);
  const executable = action.status === "approved" || (action.policyDecision === "auto_execute" && ["proposed", "failed"].includes(action.status));
  if (!executable) throw new HttpError(409, "invalid_state", `Action is ${action.status} and cannot be executed`);

  if (!action.integrationId) {
    throw new HttpError(409, "manual_required", "No connected integration can apply this change. Use the manual instructions.", {
      instructions: buildManualInstructions({ type: action.type, target: targetOf(action), proposedChange: changeOf(action), rationale: action.rationale }),
    });
  }
  // The stored decision is authoritative too: if review was ever required (e.g. AI-written text), an approval of
  // the exact current draft must exist even if a fresh policy evaluation would now allow auto-execution.
  if (action.policyDecision !== "auto_execute") {
    const approved = await db.approval.findFirst({
      where: { actionId: action.id, organizationId: action.organizationId, decision: "approved", draftHash: hashOf(action) },
    });
    if (!approved) throw new HttpError(409, "approval_required", "No approval exists for the exact current draft.");
  }
  const gate = await checkExecutionGate(action);
  if (!gate.ok) {
    await writeAuditLog({
      organizationId: action.organizationId, ...actorOf(session),
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
    organizationId: action.organizationId, ...actorOf(session),
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
    organizationId: action.organizationId, ...auditActorFromSession(session), action: "action.rollback_requested",
    resourceType: "action", resourceId: action.id, after: { workflowRunId: run.id, executionId: execution.id },
  });
  return run;
}

// ---------------------------------------------------------------------------------------------
// Applied changes + manual completion (round 4, measurement history).

/** Statuses that mean a change really reached the site (auto-applied, or done by hand and recorded). */
export const APPLIED_STATUSES = ["succeeded", "succeeded_with_warnings", "completed_manually"] as const;

/**
 * Prisma filter for "Changes applied": an applied status AND a successful ActionExecution. The execution
 * requirement excludes class A briefs/internal tasks that older versions auto-marked "succeeded".
 */
export function appliedChangeWhere(organizationId: string, projectId?: string): Prisma.ActionWhereInput {
  return {
    organizationId,
    ...(projectId ? { projectId } : {}),
    status: { in: [...APPLIED_STATUSES] },
    executions: { some: { result: { in: ["success", "partial"] } } },
  };
}

/** Pure version of appliedChangeWhere for already-loaded rows. */
export function isAppliedChange(a: { status: string; executions?: { result: string }[] | null }): boolean {
  return (APPLIED_STATUSES as readonly string[]).includes(a.status) && (a.executions ?? []).some((e) => e.result === "success" || e.result === "partial");
}

const MANUAL_COMPLETABLE = ["proposed", "awaiting_approval", "approved", "blocked", "failed", "expired"];

/**
 * Record that a person applied this change by hand (manual connector, blocked, or a class A brief that was
 * published). Admin+ (staff support mode resolves to admin). Writes an ActionExecution (connector "manual",
 * result "success") so it counts as an applied change, plus an audit log entry.
 */
export async function completeManually(actionId: string, body: { note?: string; url?: string }, session: SessionContext) {
  if (ROLE_RANK[session.role] < ROLE_RANK.admin && !session.staffMode) {
    throw new HttpError(403, "forbidden", "Only an admin or owner can mark a change as done");
  }
  const action = await loadAction(actionId, session.organizationId);
  if (!MANUAL_COMPLETABLE.includes(action.status)) {
    throw new HttpError(409, "invalid_state", `Action is ${action.status} and cannot be marked as done`);
  }
  const lastExec = await db.actionExecution.findFirst({ where: { actionId: action.id, organizationId: action.organizationId }, orderBy: { startedAt: "desc" } });
  const manualOnly =
    !action.integrationId ||
    action.riskClass === "A" ||
    action.status === "blocked" ||
    action.policyDecision === "blocked" ||
    action.status === "failed" ||
    lastExec?.result === "failure";
  if (!manualOnly) {
    throw new HttpError(409, "auto_apply_available", "This change can be applied automatically through the connected site. Use Apply instead.");
  }

  const now = new Date();
  const note = body.note?.trim() || null;
  const url = body.url?.trim() || targetOf(action)?.url || null;
  const execution = await db.actionExecution.create({
    data: {
      organizationId: action.organizationId,
      actionId: action.id,
      connector: "manual",
      idempotencyKey: `manual:${action.id}:${now.getTime()}`,
      result: "success",
      resultDetail: { manual: true, note, url, completedBy: session.userId, staffMode: !!session.staffMode } as Prisma.InputJsonValue,
      rollbackStatus: "manual_required",
      startedAt: now,
      finishedAt: now,
    },
  });
  await db.approval.updateMany({
    where: { actionId: action.id, organizationId: action.organizationId, decision: "pending" },
    data: { decision: "invalidated", decidedAt: now, comments: "Completed manually" },
  });
  const updated = await db.action.update({ where: { id: action.id }, data: { status: "completed_manually" } });
  await writeAuditLog({
    organizationId: action.organizationId,
    ...auditActorFromSession(session),
    action: "action.completed_manually",
    resourceType: "action",
    resourceId: action.id,
    before: { status: action.status },
    after: { status: "completed_manually", executionId: execution.id, note, url },
  });
  return { action: updated, execution };
}
