// Read-only: fetch a Razorpay subscription plan (GET /v1/plans/{id}) to check its amount. Server-only.
// Razorpay charges subscribers the amount set on the PLAN in the Razorpay dashboard; the code can't change it.

const API = "https://api.razorpay.com/v1";

export interface RazorpayPlan {
  id: string;
  period?: string;
  interval?: number;
  item?: { name?: string; amount?: number; currency?: string };
}

export async function fetchRazorpayPlan(planId: string): Promise<RazorpayPlan> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}/plans/${encodeURIComponent(planId)}`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Razorpay returned ${res.status}`);
  return (await res.json()) as RazorpayPlan;
}
