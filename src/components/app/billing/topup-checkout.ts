// Opens Razorpay Checkout for a one-time ORDER (AI-answer top-up). checkout.js is loaded only when someone clicks
// "Pay" (loadRazorpay). The success callback is informational: answers are added by the signed webhook.
import { loadRazorpay } from "./razorpay-checkout";

interface OrderCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  handler: (response: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}
type OrderCtor = new (o: OrderCheckoutOptions) => { open(): void; on(event: string, cb: (resp: unknown) => void): void };

export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function themeColor(): string | undefined {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined;
}

export async function openRazorpayOrder(o: {
  keyId: string;
  orderId: string;
  amount: number;
  name: string;
  description: string;
  onSuccess: (r: CheckoutSuccess | null) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
}): Promise<void> {
  const Razorpay = (await loadRazorpay()) as unknown as OrderCtor;
  const rzp = new Razorpay({
    key: o.keyId,
    order_id: o.orderId,
    amount: o.amount,
    currency: "INR",
    name: o.name,
    description: o.description,
    handler: (r) =>
      o.onSuccess(
        r?.razorpay_order_id && r.razorpay_payment_id && r.razorpay_signature
          ? { razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }
          : null,
      ),
    modal: { ondismiss: o.onDismiss },
    theme: { color: themeColor() },
  });
  rzp.on("payment.failed", (resp) => {
    const desc = (resp as { error?: { description?: string } })?.error?.description;
    o.onFailure(desc ? `Payment didn't go through: ${desc}. No money was taken — please try again.` : "Payment didn't go through. No money was taken — please try again.");
  });
  rzp.open();
}
