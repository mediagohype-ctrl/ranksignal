import { handler, json, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getUsageSummary } from "@/lib/billing/usage";
import { getPlan } from "@/lib/billing/plans";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const org = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { planId: true, status: true } });
  const plan = getPlan(org.planId);
  const [summary, projects, prompts, seats, subscription] = await Promise.all([
    getUsageSummary(s.organizationId),
    db.project.count({ where: { organizationId: s.organizationId } }),
    db.trackedPrompt.count({ where: { organizationId: s.organizationId, active: true } }),
    db.membership.count({ where: { organizationId: s.organizationId, status: { in: ["active", "invited"] } } }),
    db.subscription.findFirst({
      where: { organizationId: s.organizationId },
      orderBy: { createdAt: "desc" },
      select: { planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
  ]);
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
      },
    },
  });
});
