// Plan access (is this organization allowed to start new scans?). Read-only: billing state is changed only by the
// signed Razorpay webhook. Rules:
//   - suspended organization                → inactive ("suspended")
//   - trial plan                            → active until Subscription.trialEndsAt (or org.createdAt + TRIAL_DAYS)
//   - paid plan, subscription active/trialing → active
//   - paid plan, past_due                   → active for PAST_DUE_GRACE_DAYS after Subscription.updatedAt, then inactive
//   - paid plan, cancelled/expired          → active until currentPeriodEnd (already paid for), then inactive
//   - paid plan with no subscription row (e.g. set by staff) → follows Organization.status
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getPlan, TRIAL_DAYS } from "./plans";

export const PAST_DUE_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessReason = "trial_expired" | "past_due" | "cancelled" | "suspended";

export interface OrgAccess {
  active: boolean;
  /** Why access is (or is about to be) restricted. Set with active=true while a past_due grace period runs. */
  reason?: AccessReason;
  trialEndsAt?: Date | null;
  planId: string;
  /** Extra detail for UI (optional, additive to the shared contract). */
  graceEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  subscriptionStatus?: string | null;
}

export interface AccessOrg {
  planId: string;
  status: string;
  createdAt?: Date | null;
}
export interface AccessSubscription {
  planId: string;
  status: string;
  provider?: string | null;
  providerSubscriptionId?: string | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
}

/** Pure rule evaluation (exported for tests). `subs` newest first. */
export function evaluateAccess(org: AccessOrg, subs: AccessSubscription[], now = new Date()): OrgAccess {
  const planId = org.planId;
  if (org.status === "suspended") return { active: false, reason: "suspended", planId };

  if (planId === "trial") {
    const trialSub = subs.find((s) => s.status === "trialing" && s.trialEndsAt);
    const trialEndsAt =
      trialSub?.trialEndsAt ?? (org.createdAt ? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS) : null);
    if (org.status === "cancelled") return { active: false, reason: "cancelled", trialEndsAt, planId };
    if (trialEndsAt && now.getTime() >= trialEndsAt.getTime()) {
      return { active: false, reason: "trial_expired", trialEndsAt, planId, subscriptionStatus: trialSub?.status ?? null };
    }
    return { active: true, trialEndsAt, planId, subscriptionStatus: trialSub?.status ?? null };
  }

  // Paid plan: the newest provider subscription is authoritative.
  // (Trial rows created at signup have no provider id and are ignored here.)
  const sub = subs.find((s) => s.providerSubscriptionId) ?? null;
  const base = { planId, trialEndsAt: null, currentPeriodEnd: sub?.currentPeriodEnd ?? null, subscriptionStatus: sub?.status ?? null };
  if (!sub) {
    if (org.status === "past_due") return { ...base, active: false, reason: "past_due" };
    if (org.status === "cancelled") return { ...base, active: false, reason: "cancelled" };
    return { ...base, active: true };
  }
  switch (sub.status) {
    case "active":
    case "trialing":
      return { ...base, active: true };
    case "past_due": {
      const since = sub.updatedAt ?? sub.createdAt ?? now;
      const graceEndsAt = new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
      return { ...base, active: now.getTime() < graceEndsAt.getTime(), reason: "past_due", graceEndsAt };
    }
    default: {
      // cancelled / expired: keep access for the period already paid for.
      const paidUntil = sub.currentPeriodEnd;
      if (paidUntil && now.getTime() < paidUntil.getTime()) return { ...base, active: true, reason: "cancelled" };
      return { ...base, active: false, reason: "cancelled" };
    }
  }
}

export async function getOrgAccess(orgId: string, now = new Date()): Promise<OrgAccess> {
  const [org, subs] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { planId: true, status: true, createdAt: true } }),
    db.subscription.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        planId: true,
        status: true,
        provider: true,
        providerSubscriptionId: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
  ]);
  if (!org) return { active: false, reason: "suspended", planId: "trial" };
  return evaluateAccess(org, subs ?? [], now);
}

/** Plain-English explanation of an inactive/limited state (for 402 messages and banners). */
export function accessMessage(a: OrgAccess): string {
  const plan = getPlan(a.planId).name;
  switch (a.reason) {
    case "trial_expired":
      return "Your free trial has ended. Choose a plan to keep running scans and AI checks.";
    case "past_due":
      return a.active
        ? "We couldn't take your last payment. Please update your payment details to avoid a pause in scans."
        : "Scans are paused because your last payment didn't go through. Update your payment details or choose a plan to continue.";
    case "cancelled":
      return a.active
        ? `Your ${plan} plan is cancelled and stays active until the end of the current billing period.`
        : `Your ${plan} plan has ended. Choose a plan to keep running scans and AI checks.`;
    case "suspended":
      return "This workspace is suspended. Please contact support.";
    default:
      return `Your ${plan} plan is active.`;
  }
}

/** Throws HttpError 402 "plan_inactive" when the organization may not start new scans. */
export async function assertOrgActive(orgId: string): Promise<OrgAccess> {
  const access = await getOrgAccess(orgId);
  if (!access.active) {
    throw new HttpError(402, "plan_inactive", accessMessage(access), {
      reason: access.reason,
      planId: access.planId,
      upgradeUrl: "/app/settings?tab=billing",
    });
  }
  return access;
}
