import { handler, json, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const [user, membership, memberships, subscription] = await Promise.all([
    db.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, name: true, emailVerified: true, isStaff: true } }),
    db.membership.findUnique({
      where: { userId_organizationId: { userId: s.userId, organizationId: s.organizationId } },
      include: { organization: { select: { id: true, name: true, planId: true, status: true, region: true, publishingEnabled: true } } },
    }),
    db.membership.findMany({
      where: { userId: s.userId, status: { in: ["active", "invited"] } },
      select: { organizationId: true, role: true, status: true, organization: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.subscription.findFirst({
      where: { organizationId: s.organizationId },
      orderBy: { createdAt: "desc" },
      select: { planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true },
    }),
  ]);
  if (!user || !membership || membership.status !== "active") throw new HttpError(401, "unauthorized", "Session is no longer valid");

  return json({
    item: {
      user,
      organization: membership.organization,
      role: membership.role,
      plan: getPlan(membership.organization.planId),
      subscription,
      organizations: memberships.map((m) => ({ id: m.organizationId, name: m.organization.name, role: m.role, status: m.status })),
    },
  });
});
