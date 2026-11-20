// Meta "Subscribe" event when a paid subscription goes active (Razorpay webhook or the server-side sync).
// Both paths use the same event id per Razorpay subscription, so Meta counts it once. Best-effort, never throws.
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { gstConfig } from "@/lib/billing/gst";
import { metaConfigured, trackMeta } from "./capi";

/** Monthly price the customer pays, including GST when we are registered (what Meta should count as value). */
export function subscribeValue(planId: string, env: Record<string, string | undefined> = process.env): number {
  const base = getPlan(planId).priceInrMonthly ?? 0;
  const gst = gstConfig(env);
  return gst.registered ? Math.round(base * (1 + gst.ratePercent / 100)) : base;
}

export async function trackSubscribe(organizationId: string, providerSubscriptionId: string): Promise<void> {
  if (!metaConfigured()) return;
  try {
    const [org, owner] = await Promise.all([
      db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } }),
      db.membership.findFirst({
        where: { organizationId, role: "owner", status: "active" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { email: true } } },
      }),
    ]);
    if (!org) return;
    trackMeta({
      name: "Subscribe",
      eventId: `subscribe-${providerSubscriptionId}`,
      actionSource: "system_generated",
      user: { email: owner?.user.email ?? null, externalId: organizationId },
      custom: { value: subscribeValue(org.planId), currency: "INR", content_name: org.planId },
    });
  } catch {
    /* never block billing */
  }
}
