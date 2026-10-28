import { handler, json } from "@/lib/api";
import { processRazorpayWebhook } from "@/lib/billing/webhook";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return json({ error: { code: "billing_not_configured", message: "Webhook secret not configured" } }, { status: 501 });
  }
  // Raw body is required for signature verification — do not call req.json() first.
  const raw = await req.text();
  if (raw.length > 1_000_000) return json({ error: { code: "payload_too_large", message: "Payload too large" } }, { status: 413 });

  const result = await processRazorpayWebhook(raw, {
    signature: req.headers.get("x-razorpay-signature"),
    eventId: req.headers.get("x-razorpay-event-id"),
  });
  switch (result.status) {
    case "invalid_signature":
      return json({ error: { code: "invalid_signature", message: "Invalid signature" } }, { status: 401 });
    case "invalid_payload":
      return json({ error: { code: "invalid_payload", message: "Invalid payload" } }, { status: 400 });
    default:
      // duplicate / ignored / processed all ack with 200 so Razorpay stops retrying.
      return json({ ok: true, status: result.status });
  }
});
