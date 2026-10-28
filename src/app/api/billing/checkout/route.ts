import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { PAID_PLAN_IDS, razorpayPlanIdFor } from "@/lib/billing/plans";
import { createRazorpaySubscription, isRazorpayConfigured } from "@/lib/billing/razorpay";
import { writeAuditLog } from "@/lib/audit-log";

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
      { error: { code: "billing_not_configured", message: "Online billing is not configured on this server (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET). Contact support to change plans." } },
      { status: 501 },
    );
  }
  const razorpayPlanId = razorpayPlanIdFor(planId);
  if (!razorpayPlanId) {
    return json(
      { error: { code: "billing_not_configured", message: `No Razorpay plan configured for "${planId}" (set RAZORPAY_PLAN_${planId.toUpperCase()}).` } },
      { status: 501 },
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
