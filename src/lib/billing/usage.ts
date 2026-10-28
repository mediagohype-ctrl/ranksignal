// Credit ledger (blueprint §10). Rows: reservation | actual | release, bucketed by billingPeriod YYYY-MM (UTC).
//   used     = sum(actual)
//   reserved = max(0, sum(reservation) - sum(release))
// Flow for metered work: reserveCredits -> do work -> recordUsage(actual) -> releaseReservation(same credits).
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { JobError } from "@/lib/types";
import { getPlan } from "./plans";

export const USAGE_THRESHOLDS = [0.8, 1] as const;

export function billingPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Tx = Pick<typeof db, "usageLedger" | "organization">;

async function loadOrgPlan(client: Tx, orgId: string) {
  const org = await client.organization.findUnique({ where: { id: orgId }, select: { planId: true, status: true } });
  if (!org) throw new JobError("Organization not found", "permanent");
  return { org, plan: getPlan(org.planId) };
}

async function periodTotals(client: Tx, orgId: string, period: string) {
  const rows = await client.usageLedger.groupBy({
    by: ["kind", "taskType"],
    where: { organizationId: orgId, billingPeriod: period },
    _sum: { credits: true },
  });
  let used = 0;
  let reservations = 0;
  let releases = 0;
  const byTaskType: Record<string, number> = {};
  for (const r of rows) {
    const c = r._sum.credits ?? 0;
    if (r.kind === "actual") {
      used += c;
      byTaskType[r.taskType] = (byTaskType[r.taskType] ?? 0) + c;
    } else if (r.kind === "reservation") reservations += c;
    else if (r.kind === "release") releases += c;
  }
  return { used, reserved: Math.max(0, reservations - releases), byTaskType };
}

export async function reserveCredits(
  orgId: string,
  o: { provider: string; taskType: string; credits: number; runId?: string; projectId?: string },
): Promise<void> {
  if (!Number.isInteger(o.credits) || o.credits < 0) throw new JobError("credits must be a non-negative integer", "permanent");
  if (o.credits === 0) return;
  const period = billingPeriod();
  // Interactive transaction: check + insert together. A per-organization advisory lock (released at commit)
  // stops two concurrent jobs from both passing the limit check.
  await db.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === "function") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
    const { org, plan } = await loadOrgPlan(tx, orgId);
    if (org.status === "suspended" || org.status === "cancelled") {
      throw new JobError(`Organization billing status is ${org.status}`, "quota");
    }
    const { used, reserved } = await periodTotals(tx, orgId, period);
    if (used + reserved + o.credits > plan.monthlyCredits) {
      throw new JobError(
        `Monthly credit limit reached (${used} used + ${reserved} reserved + ${o.credits} requested > ${plan.monthlyCredits})`,
        "quota",
      );
    }
    await tx.usageLedger.create({
      data: {
        organizationId: orgId,
        projectId: o.projectId ?? null,
        provider: o.provider,
        taskType: o.taskType,
        runId: o.runId ?? null,
        kind: "reservation",
        credits: o.credits,
        billingPeriod: period,
      },
    });
  });
}

export async function recordUsage(
  orgId: string,
  o: { provider: string; taskType: string; credits: number; costMicros: number; runId?: string; projectId?: string },
): Promise<void> {
  if (o.credits < 0) throw new JobError("credits must be non-negative", "permanent");
  const period = billingPeriod();
  const before = await periodTotals(db, orgId, period);
  await db.usageLedger.create({
    data: {
      organizationId: orgId,
      projectId: o.projectId ?? null,
      provider: o.provider,
      taskType: o.taskType,
      runId: o.runId ?? null,
      kind: "actual",
      credits: o.credits,
      costMicros: Math.max(0, Math.round(o.costMicros)),
      billingPeriod: period,
    },
  });
  await maybeNotifyThreshold(orgId, period, before.used, before.used + o.credits);
}

export async function releaseReservation(
  orgId: string,
  o: { provider: string; taskType: string; credits: number; runId?: string },
): Promise<void> {
  if (o.credits <= 0) return;
  await db.usageLedger.create({
    data: {
      organizationId: orgId,
      provider: o.provider,
      taskType: o.taskType,
      runId: o.runId ?? null,
      kind: "release",
      credits: o.credits,
      billingPeriod: billingPeriod(),
    },
  });
}

export async function getUsageSummary(
  orgId: string,
): Promise<{ period: string; used: number; reserved: number; limit: number; byTaskType: Record<string, number> }> {
  const period = billingPeriod();
  const { plan } = await loadOrgPlan(db, orgId);
  const { used, reserved, byTaskType } = await periodTotals(db, orgId, period);
  return { period, used, reserved, limit: plan.monthlyCredits, byTaskType };
}

/** Emits a usage_threshold notification (event usage.threshold_reached) when 80% / 100% is crossed. */
async function maybeNotifyThreshold(orgId: string, period: string, usedBefore: number, usedAfter: number) {
  const { plan } = await loadOrgPlan(db, orgId);
  const limit = plan.monthlyCredits;
  if (limit <= 0) return;
  for (const t of USAGE_THRESHOLDS) {
    const mark = limit * t;
    if (usedBefore < mark && usedAfter >= mark) {
      const pct = Math.round(t * 100);
      await db.notification.create({
        data: {
          organizationId: orgId,
          type: "usage_threshold",
          title: pct >= 100 ? `Monthly credits exhausted (${period})` : `${pct}% of monthly credits used (${period})`,
          body:
            pct >= 100
              ? `Your organization has used all ${limit} credits for ${period}. New scans will pause until the next period or an upgrade.`
              : `Your organization has used ${usedAfter} of ${limit} credits for ${period}.`,
          link: "/app/settings/billing",
        },
      });
    }
  }
}

// ---------- Plan-limit guards for API routes (HTTP 402 "plan_limit") ----------

async function orgPlanForHttp(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");
  return getPlan(org.planId);
}

export async function assertProjectLimit(orgId: string): Promise<void> {
  const plan = await orgPlanForHttp(orgId);
  const count = await db.project.count({ where: { organizationId: orgId } });
  if (count >= plan.maxProjects) {
    throw new HttpError(402, "plan_limit", `Your ${plan.name} plan allows ${plan.maxProjects} project(s). Upgrade to add more.`, {
      limit: plan.maxProjects,
      current: count,
    });
  }
}

/** Tracked-prompt limit is plan-wide (all active prompts across the organization's projects). */
export async function assertPromptLimit(orgId: string, projectId: string, adding: number): Promise<void> {
  const plan = await orgPlanForHttp(orgId);
  const count = await db.trackedPrompt.count({ where: { organizationId: orgId, active: true } });
  if (count + adding > plan.maxTrackedPrompts) {
    throw new HttpError(
      402,
      "plan_limit",
      `Your ${plan.name} plan allows ${plan.maxTrackedPrompts} active tracked prompts (currently ${count}).`,
      { limit: plan.maxTrackedPrompts, current: count, adding, projectId },
    );
  }
}
