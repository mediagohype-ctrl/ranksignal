// Backend execution gate (blueprint §6.2). Re-run on every execution request AND inside the job:
// policy re-check, exact-hash approval, tenant + global kill switches, per-action-type flag.
import type { Action, Integration, Project } from "@prisma/client";
import { db } from "@/lib/db";
import { isEnabled } from "@/lib/flags";
import { classifyAction, pageSignalsFor, type PolicyResult } from "@/lib/policy/engine";
import { draftHash } from "@/lib/actions/hash";
import type { ActionTarget, ConnectorCapabilities, ProposedChange } from "@/lib/types";

export interface ProjectSettings {
  automation?: { allowClassB?: string[] };
  keyPages?: string[];
  highTrafficUrls?: string[];
}

export function targetOf(a: Pick<Action, "target">): ActionTarget | null {
  return (a.target as ActionTarget | null) ?? null;
}
export function changeOf(a: Pick<Action, "proposedChange">): ProposedChange | null {
  return (a.proposedChange as ProposedChange | null) ?? null;
}

export function hashOf(a: Pick<Action, "type" | "target" | "proposedChange" | "policyVersion">) {
  return draftHash({ type: a.type, target: a.target, proposedChange: a.proposedChange, policyVersion: a.policyVersion });
}

/** Classify an action against current project settings and (optionally) connector capabilities. */
export function evaluatePolicy(
  a: Pick<Action, "type" | "target" | "proposedChange">,
  project: Pick<Project, "websiteUrl" | "settings">,
  connector: ConnectorCapabilities | null | undefined,
): PolicyResult {
  const settings = (project.settings as ProjectSettings | null) ?? {};
  const target = targetOf(a);
  return classifyAction({
    type: a.type,
    target,
    proposedChange: changeOf(a),
    automation: settings.automation ?? null,
    page: pageSignalsFor(target?.url, project.websiteUrl, settings),
    connector,
  });
}

export function capabilitiesOf(integration: Pick<Integration, "capabilities"> | null): ConnectorCapabilities | null {
  if (!integration) return null;
  return (integration.capabilities as ConnectorCapabilities | null) ?? null;
}

/** Per-action-type flag: a missing row means enabled; an explicit disabled row is a kill switch. */
export async function actionTypeEnabled(type: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key: `action.${type}` } });
  return flag ? flag.enabled : true;
}

export type GateResult =
  | { ok: true; hash: string; policy: PolicyResult }
  | { ok: false; code: string; message: string; policy?: PolicyResult };

export async function checkExecutionGate(
  action: Action,
  opts: { capabilities?: ConnectorCapabilities | null } = {},
): Promise<GateResult> {
  const hash = hashOf(action);
  if (action.draftHash && action.draftHash !== hash) {
    return { ok: false, code: "stale_draft", message: "Stored draft hash does not match the current draft." };
  }
  const [project, org, integration] = await Promise.all([
    db.project.findFirst({ where: { id: action.projectId, organizationId: action.organizationId } }),
    db.organization.findUnique({ where: { id: action.organizationId } }),
    action.integrationId
      ? db.integration.findFirst({ where: { id: action.integrationId, organizationId: action.organizationId } })
      : Promise.resolve(null),
  ]);
  if (!project || !org) return { ok: false, code: "not_found", message: "Project or organization not found." };

  const caps = opts.capabilities !== undefined ? opts.capabilities : capabilitiesOf(integration);
  if (action.integrationId && !integration) return { ok: false, code: "integration_missing", message: "The integration for this action was disconnected." };
  if (integration && !integration.credentialEncrypted && integration.provider !== "manual") {
    return { ok: false, code: "integration_disconnected", message: "The integration has no stored credentials." };
  }

  const policy = evaluatePolicy(action, project, caps);
  if (policy.decision === "blocked") return { ok: false, code: "policy_blocked", message: policy.reason, policy };
  if (policy.riskClass === "A") return { ok: false, code: "not_executable", message: "Class A actions are internal tasks and are not executed against a site.", policy };

  if (policy.decision === "approval_required") {
    const approval = await db.approval.findFirst({
      where: { actionId: action.id, organizationId: action.organizationId, decision: "approved", draftHash: hash },
      orderBy: { decidedAt: "desc" },
    });
    if (!approval) return { ok: false, code: "approval_required", message: "No approval exists for the exact current draft.", policy };
  }

  if (!org.publishingEnabled) return { ok: false, code: "publishing_disabled", message: "Publishing is disabled for this organization.", policy };
  if (!(await isEnabled("global.publishing"))) return { ok: false, code: "publishing_paused", message: "Publishing is globally paused (kill switch).", policy };
  if (!(await actionTypeEnabled(action.type))) return { ok: false, code: "action_type_disabled", message: `Action type ${action.type} is disabled.`, policy };

  return { ok: true, hash, policy };
}
