import { handler, HttpError, json, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { writeAuditLog } from "@/lib/audit-log";
import { cancelRazorpaySubscription, isRazorpayConfigured } from "@/lib/billing/razorpay";
import { getCancelRequestedAt, getCurrentProviderSubscription } from "@/lib/billing/subscription";

/**
 * Cancels the organization's Razorpay subscription at the end of the current billing cycle.
 * The plan keeps working until currentPeriodEnd; the signed webhook (subscription.cancelled) applies the change.
 */
export const POST = handler(async () => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  if (!isRazorpayConfigured()) {
    throw new HttpError(501, "billing_not_configured", "Online billing isn't available yet. Contact support to cancel your plan.");
  }
  const sub = await getCurrentProviderSubscription(s.organizationId);
  if (!sub?.providerSubscriptionId || sub.provider !== "razorpay" || !["active", "past_due"].includes(sub.status)) {
    throw new HttpError(404, "no_subscription", "There is no active paid subscription to cancel.");
  }
  const already = await getCancelRequestedAt(s.organizationId, sub.providerSubscriptionId);
  if (already) {
    return json({ item: { subscriptionId: sub.providerSubscriptionId, cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd } });
  }

  try {
    await cancelRazorpaySubscription(sub.providerSubscriptionId, true);
  } catch {
    throw new HttpError(502, "billing_provider_error", "We couldn't reach the payment provider to cancel. Please try again in a minute.");
  }
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "billing.cancel_requested",
    resourceType: "subscription",
    resourceId: sub.providerSubscriptionId,
    after: { atCycleEnd: true, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null },
  });
  return json({ item: { subscriptionId: sub.providerSubscriptionId, cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd } });
});
