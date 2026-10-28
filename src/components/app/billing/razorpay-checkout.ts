// Loads Razorpay Checkout.js on demand (only when someone clicks upgrade) and opens it for a subscription.
// The success callback is informational only: the plan changes when the signed webhook arrives.
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler: (response: Record<string, string>) => void;
  modal?: { ondismiss?: () => void };
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  notes?: Record<string, string>;
}
interface RazorpayInstance {
  open(): void;
  on(event: string, cb: (resp: unknown) => void): void;
}
type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

let loading: Promise<RazorpayCtor> | null = null;

export function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (loading) return loading;
  loading = new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => {
      s.remove();
      reject(new Error("Couldn't load the payment window. Check your connection or ad blocker and try again."));
    };
    document.head.appendChild(s);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Brand colour for the Razorpay modal, read from the design token (hex only; otherwise Razorpay's default). */
function themeColor(): string | undefined {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined;
}

export async function openRazorpaySubscription(o: {
  keyId: string;
  subscriptionId: string;
  name: string;
  description: string;
  email?: string;
  onSuccess: () => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
}): Promise<void> {
  const Razorpay = await loadRazorpay();
  const rzp = new Razorpay({
    key: o.keyId,
    subscription_id: o.subscriptionId,
    name: o.name,
    description: o.description,
    handler: () => o.onSuccess(),
    modal: { ondismiss: o.onDismiss },
    prefill: o.email ? { email: o.email } : undefined,
    theme: { color: themeColor() },
  });
  rzp.on("payment.failed", (resp) => {
    const desc = (resp as { error?: { description?: string } })?.error?.description;
    o.onFailure(desc ? `Payment failed: ${desc}` : "Payment failed. No money was taken — please try again.");
  });
  rzp.open();
}
