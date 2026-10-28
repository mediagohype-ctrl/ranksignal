// Razorpay REST client (subscriptions) + webhook signature verification. Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** HMAC-SHA256(rawBody, secret) hex compared in constant time. Never parse the body before verifying. */
export function verifyRazorpaySignature(rawBody: string, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string> | null;
}

export async function createRazorpaySubscription(o: {
  razorpayPlanId: string;
  organizationId: string;
  planId: string;
  totalCount?: number;
}): Promise<RazorpaySubscription> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}/subscriptions`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: o.razorpayPlanId,
      total_count: o.totalCount ?? 120,
      customer_notify: 1,
      // notes are echoed back on signed webhooks and used to map the subscription to the tenant
      notes: { organizationId: o.organizationId, planId: o.planId },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // Do not echo provider error bodies to clients; log status only.
    console.error("[billing] razorpay create subscription failed", res.status);
    throw new Error(`Razorpay returned ${res.status}`);
  }
  return (await res.json()) as RazorpaySubscription;
}

/** Cancel a subscription. With atCycleEnd the customer keeps the paid period; the signed webhook applies the change. */
export async function cancelRazorpaySubscription(subscriptionId: string, atCycleEnd = true): Promise<RazorpaySubscription> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("[billing] razorpay cancel subscription failed", res.status);
    throw new Error(`Razorpay returned ${res.status}`);
  }
  return (await res.json()) as RazorpaySubscription;
}
