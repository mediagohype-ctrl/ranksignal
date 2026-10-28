import { handler, json, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getUsageSummary } from "@/lib/billing/usage";
import { getPlan, PAID_PLAN_IDS, razorpayPlanIdFor } from "@/lib/billing/plans";
import { accessMessage, getOrgAccess } from "@/lib/billing/access";
import { getVisibilityRunAllowance } from "@/lib/billing/ai-limits";
import { getAiBudgetStatus } from "@/lib/billing/ai-budget";
import { isRazorpayConfigured } from "@/lib/billing/razorpay";
import { getCancelRequestedAt, getCurrentProviderSubscription } from "@/lib/billing/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const orgId = s.organizationId;
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { planId: true, status: true } });
  const plan = getPlan(org.planId);
  const [summary, projects, prompts, seats, subscription, access, aiChecks, providerSub, user] = await Promise.all([
    getUsageSummary(orgId),
    db.project.count({ where: { organizationId: orgId } }),
    db.trackedPrompt.count({ where: { organizationId: orgId, active: true } }),
    db.membership.count({ where: { organizationId: orgId, status: { in: ["active", "invited"] } } }),
    db.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
    getOrgAccess(orgId),
    getVisibilityRunAllowance(orgId),
    getCurrentProviderSubscription(orgId),
    db.user.findUnique({ where: { id: s.userId }, select: { isStaff: true } }),
  ]);
  const cancelRequestedAt = providerSub?.providerSubscriptionId
    ? await getCancelRequestedAt(orgId, providerSub.providerSubscriptionId)
    : null;
  const now = Date.now();
  const trialDaysLeft =
    access.planId === "trial" && access.trialEndsAt ? Math.max(0, Math.ceil((access.trialEndsAt.getTime() - now) / DAY_MS)) : null;

  return json({
    item: {
      ...summary,
      percentUsed: summary.limit > 0 ? Math.min(100, Math.round((summary.used / summary.limit) * 100)) : 0,
      plan,
      organizationStatus: org.status,
      subscription,
      limits: {
        projects: { used: projects, limit: plan.maxProjects },
        trackedPrompts: { used: prompts, limit: plan.maxTrackedPrompts },
        seats: { used: seats, limit: plan.seats },
        aiChecks: { used: aiChecks.used, limit: aiChecks.limit },
      },
      access: { ...access, trialDaysLeft, message: accessMessage(access) },
      aiChecks,
      billing: {
        checkoutAvailable: isRazorpayConfigured() && PAID_PLAN_IDS.some((id) => Boolean(razorpayPlanIdFor(id))),
        checkoutPlans: isRazorpayConfigured() ? PAID_PLAN_IDS.filter((id) => Boolean(razorpayPlanIdFor(id))) : [],
        supportEmail: BRAND.supportEmail,
        subscription: providerSub
          ? {
              planId: providerSub.planId,
              status: providerSub.status,
              currentPeriodStart: providerSub.currentPeriodStart,
              currentPeriodEnd: providerSub.currentPeriodEnd,
              cancelAtPeriodEnd: Boolean(cancelRequestedAt),
              cancelRequestedAt,
            }
          : null,
      },
      // Platform-wide spend is visible to staff only.
      ...(user?.isStaff ? { aiBudget: await getAiBudgetStatus() } : {}),
    },
  });
});
