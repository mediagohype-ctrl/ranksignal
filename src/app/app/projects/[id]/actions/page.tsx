import { db } from "@/lib/db";
import { hashOf, changeOf, targetOf } from "@/lib/actions/gate";
import { buildManualInstructions } from "@/lib/connectors/manual";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asArray, asRecord } from "@/lib/dashboard/format";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { ActionCenter, type ActionView } from "@/components/app/action-center";
import { RiskLegend } from "@/components/app/actions/risk-legend";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Actions & Approvals" };

export default async function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const actions = await db.action.findMany({
    where: { organizationId: session.organizationId, projectId: project.id },
    orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
    take: 300,
    include: {
      approvals: { orderBy: { createdAt: "desc" }, take: 10 },
      executions: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  // Resolve names for the people in each action's history (only ids referenced by this org's approvals).
  const userIds = Array.from(
    new Set(actions.flatMap((a) => a.approvals.flatMap((p) => [p.requestedBy, p.approverId])).filter((x): x is string => !!x)),
  );
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nameOf = (uid: string | null) => {
    if (!uid) return null;
    const u = users.find((x) => x.id === uid);
    return u ? (u.name ?? u.email) : null;
  };

  const views: ActionView[] = actions.map((a) => {
    const target = targetOf(a);
    const change = changeOf(a);
    const ap = a.approvals[0];
    const ex = a.executions[0];
    const exDetail = ex ? asRecord<unknown>(ex.resultDetail) : {};
    const execInstructions = typeof exDetail.instructions === "string" ? exDetail.instructions : null;
    const needsManual = !!change && (!a.integrationId || a.policyDecision === "blocked");
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      targetUrl: target?.url ?? null,
      rationale: a.rationale,
      riskClass: a.riskClass,
      policyDecision: a.policyDecision,
      policyReason: a.policyReason,
      priority: a.priority,
      priorityScore: a.priorityScore,
      expectedImpact: a.expectedImpact,
      effort: a.effort,
      confidence: a.confidence,
      evidenceRefs: asArray<unknown>(a.evidenceRefs),
      change: change && typeof change.after === "string" ? { field: change.field ?? "value", before: change.before ?? null, after: change.after } : null,
      draftHash: hashOf(a),
      integrationId: a.integrationId,
      manualInstructions: needsManual
        ? buildManualInstructions({ type: a.type, target, proposedChange: change, rationale: a.rationale })
        : execInstructions,
      approval: ap ? { decision: ap.decision, expiresAt: ap.expiresAt.toISOString(), comments: ap.comments } : null,
      execution: ex
        ? { result: ex.result, validation: ex.validation, rollbackStatus: ex.rollbackStatus, finishedAt: ex.finishedAt?.toISOString() ?? null }
        : null,
      approvals: a.approvals.map((p) => ({
        id: p.id,
        decision: p.decision,
        draftHash: p.draftHash,
        comments: p.comments,
        requestedBy: nameOf(p.requestedBy),
        approver: nameOf(p.approverId),
        createdAt: p.createdAt.toISOString(),
        decidedAt: p.decidedAt?.toISOString() ?? null,
        expiresAt: p.expiresAt.toISOString(),
      })),
      executions: a.executions.map((e) => {
        const d = asRecord<unknown>(e.resultDetail);
        const err = typeof d.error === "string" ? d.error : typeof d.message === "string" ? d.message : null;
        return {
          id: e.id,
          connector: e.connector,
          result: e.result,
          validation: e.validation,
          rollbackStatus: e.rollbackStatus,
          error: err && err !== "manual_required" ? err.slice(0, 200) : null,
          startedAt: e.startedAt.toISOString(),
          finishedAt: e.finishedAt?.toISOString() ?? null,
        };
      }),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  });
  const active = views.some((v) => ["executing", "rollback_pending"].includes(v.status));
  const canAct = hasRole(session, "member");

  return (
    <>
      <PageHeader
        eyebrow="Actions & approvals"
        title="Changes we recommend"
        description="Review each suggested fix, see exactly what will change, and decide what goes live. Nothing risky is ever applied without your say-so."
        actions={<AutoRefresh active={active} label="Changes being applied" />}
      />
      <div className="space-y-8">
        <RiskLegend />
        <ActionCenter projectId={project.id} actions={views} canEdit={canAct} canApprove={canAct} />
      </div>
    </>
  );
}
