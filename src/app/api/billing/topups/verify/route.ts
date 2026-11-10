// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature } → { item: { status } }
// Checks the Razorpay Checkout signature (HMAC of "order_id|payment_id" with the key secret) ONLY to show
// "payment received, adding your answers…" sooner. It changes nothing: answers are added by the signed webhook.
//   status: "added" (webhook already granted) | "payment_received" (valid signature, waiting for the webhook)
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { verifyCheckoutSignature } from "@/lib/billing/razorpay-orders";

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const b = await parseBody(req, schema);
  const order = await db.topUpOrder.findFirst({
    where: { razorpayOrderId: b.razorpay_order_id, organizationId: s.organizationId },
    select: { status: true },
  });
  if (!order) throw new HttpError(404, "not_found", "We couldn't find this payment.");
  if (!verifyCheckoutSignature({ orderId: b.razorpay_order_id, paymentId: b.razorpay_payment_id, signature: b.razorpay_signature })) {
    throw new HttpError(400, "invalid_signature", "We couldn't confirm this payment yet. If money was taken, your answers are added within a few minutes.");
  }
  return json({ item: { status: order.status === "paid" ? "added" : "payment_received" } });
});
