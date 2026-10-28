// Read helpers for the organization's provider subscription (state itself is written only by the webhook).
import { db } from "@/lib/db";

/** Statuses for which the customer is (still) being billed — a second checkout would double-charge. */
export const BILLABLE_SUB_STATUSES = ["active", "past_due"] as const;

export async function getCurrentProviderSubscription(orgId: string) {
  return db.subscription.findFirst({
    where: { organizationId: orgId, providerSubscriptionId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      providerSubscriptionId: true,
      planId: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      updatedAt: true,
    },
  });
}

/** When a cancel-at-period-end was requested for this subscription (from the audit trail), else null. */
export async function getCancelRequestedAt(orgId: string, providerSubscriptionId: string): Promise<Date | null> {
  const row = await db.auditLog.findFirst({
    where: { organizationId: orgId, action: "billing.cancel_requested", resourceId: providerSubscriptionId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
