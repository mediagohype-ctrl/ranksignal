// Server-side safety net for the Razorpay webhook. If a webhook is missed (not configured, wrong secret, network
// trouble), a customer who paid would stay on their old plan. This reads the organization's subscriptions
// straight from the Razorpay API with our secret key — the browser only asks "please check", it never says
// what was paid — and applies an active one exactly like the webhook would.
import { db } from "@/lib/db";
import { fetchRazorpaySubscription, isRazorpayConfigured, listRazorpaySubscriptions, type RazorpaySubscription } from "./razorpay";
import { planIdFromRazorpayPlan } from "./plans";
import { RAZORPAY_STATUS_MAP, applySubscriptionEntity } from "./webhook";

export type SyncResult =
  | { status: "not_configured" }
  | { status: "nothing_paid" }
  | { status: "already_up_to_date"; planId: string }
  | { status: "activated"; planId: string; subscriptionId: string };

const belongsTo = (s: RazorpaySubscription, organizationId: string) => s.notes?.organizationId === organizationId;

export async function syncOrganizationFromRazorpay(organizationId: string, subscriptionId?: string): Promise<SyncResult> {
  if (!isRazorpayConfigured()) return { status: "not_configured" };

  let candidates: RazorpaySubscription[];
  if (subscriptionId) {
    const one = await fetchRazorpaySubscription(subscriptionId);
    candidates = one && belongsTo(one, organizationId) ? [one] : [];
  } else {
    const all = await listRazorpaySubscriptions(100);
    candidates = all.filter((s) => belongsTo(s, organizationId)).sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
  }
  // Only a paid, running subscription switches a plan on here. Everything else (failed, cancelled) is left to
  // the signed webhook, so this can never downgrade anyone.
  const paid = candidates.find((s) => s.status === "active");
  if (!paid) return { status: "nothing_paid" };

  const planId = planIdFromRazorpayPlan(paid.plan_id) ?? (paid.notes?.planId as string | undefined) ?? null;
  const [org, existing] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, status: true } }),
    db.subscription.findUnique({ where: { providerSubscriptionId: paid.id }, select: { status: true } }),
  ]);
  if (org && existing?.status === "active" && org.status === "active" && (!planId || org.planId === planId)) {
    return { status: "already_up_to_date", planId: org.planId };
  }

  const applied = await db.$transaction((tx) => applySubscriptionEntity(tx, paid, RAZORPAY_STATUS_MAP.active!, "billing.synced_from_razorpay"));
  if (!applied.ok) return { status: "nothing_paid" };
  const after = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return { status: "activated", planId: after?.planId ?? planId ?? "unknown", subscriptionId: paid.id };
}
