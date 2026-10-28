import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { PAID_PLAN_IDS, razorpayPlanIdFor } from "@/lib/billing/plans";
import { createRazorpaySubscription, isRazorpayConfigured } from "@/lib/billing/razorpay";
import { writeAuditLog } from "@/lib/audit-log";
import { BRAND } from "@/lib/brand";
import { getCurrentProviderSubscription } from "@/lib/billing/subscription";

const schema = z.object({ planId: z.enum(PAID_PLAN_IDS) });

/**
 * Creates a Razorpay subscription and returns what the client needs to open Razorpay Checkout.
 * Plan/status changes are applied ONLY by the signed webhook (/api/webhooks/razorpay), never by this call
 * or by the client-side success redirect.
 */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const { planId } = await parseBody(req, schema);

  if (!isRazorpayConfigured()) {
    return json(
      { error: { code: "billing_not_configured", message: `Payments are coming soon. Contact ${BRAND.supportEmail} to upgrade.` } },
      { status: 501 },
    );
  }
  const razorpayPlanId = razorpayPlanIdFor(planId);
  if (!razorpayPlanId) {
    return json(
      { error: { code: "billing_not_configured", message: `Payments for this plan are coming soon. Contact ${BRAND.supportEmail} to upgrade.` } },
      { status: 501 },
    );
  }

  // A second live subscription would bill the customer twice. Plan switches go through support for now.
  const current = await getCurrentProviderSubscription(s.organizationId);
  if (current && (current.status === "active" || current.status === "past_due")) {
    throw new HttpError(
      409,
      "subscription_exists",
      current.planId === planId
        ? "You're already subscribed to this plan."
        : `You already have an active subscription. To switch plans, contact ${BRAND.supportEmail} and we'll move you over without double billing.`,
    );
  }

  let sub;
  try {
    sub = await createRazorpaySubscription({ razorpayPlanId, organizationId: s.organizationId, planId });
  } catch {
    throw new HttpError(502, "billing_provider_error", "Could not start checkout with the payment provider. Please try again.");
  }

  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "billing.checkout_started",
    resourceType: "subscription",
    resourceId: sub.id,
    after: { planId },
  });
  return json({ item: { provider: "razorpay", subscriptionId: sub.id, shortUrl: sub.short_url ?? null, keyId: process.env.RAZORPAY_KEY_ID, planId } });
});
