// Razorpay ORDERS (one-time payments, used for AI-answer top-ups) + the Checkout payment signature. Server-only.
// Granting answers happens ONLY in the signed webhook (src/lib/billing/webhook.ts); the checkout signature is used
// just to show "payment received" sooner.
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

function authHeader(): string {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  status?: string;
  notes?: Record<string, string> | null;
}

/** POST /v1/orders. `amount` in paise (GST included). Notes are echoed back on the signed webhook. */
export async function createRazorpayOrder(o: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(o.amountPaise), currency: "INR", receipt: o.receipt.slice(0, 40), notes: o.notes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // Never echo provider error bodies; status only.
    console.error("[billing] razorpay create order failed", res.status);
    throw new Error(`Razorpay returned ${res.status}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Checkout success signature: HMAC-SHA256("<order_id>|<payment_id>", key secret), hex, constant-time compare. */
export function verifyCheckoutSignature(
  o: { orderId: string; paymentId: string; signature: string | null | undefined },
  secret = process.env.RAZORPAY_KEY_SECRET,
): boolean {
  if (!secret || !o.signature || !o.orderId || !o.paymentId) return false;
  const expected = createHmac("sha256", secret).update(`${o.orderId}|${o.paymentId}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(o.signature.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
