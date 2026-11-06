// Razorpay webhook processing: verify signature -> idempotency (WebhookEvent unique) -> map to Subscription/Organization.
// Billing state is changed ONLY here (signed server-to-server events); client checkout redirects are never trusted.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { isPlanId, planIdFromRazorpayPlan } from "./plans";
import { verifyRazorpaySignature, type RazorpaySubscription } from "./razorpay";
import { applyReferralReward } from "@/lib/growth/referral";

type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";
type OrgStatus = "active" | "past_due" | "cancelled" | "suspended";

export const RAZORPAY_EVENT_MAP: Record<string, { sub: SubStatus; org: OrgStatus }> = {
  "subscription.activated": { sub: "active", org: "active" },
  "subscription.charged": { sub: "active", org: "active" },
  "subscription.pending": { sub: "past_due", org: "past_due" },
  "subscription.halted": { sub: "past_due", org: "past_due" },
  "subscription.cancelled": { sub: "cancelled", org: "cancelled" },
  "subscription.completed": { sub: "expired", org: "cancelled" },
};

/**
 * subscription.updated (e.g. a plan change made through the Razorpay update API) carries no fixed state: map it
 * from the subscription's own status. Statuses that don't change billing (created/authenticated) are ignored.
 */
export const RAZORPAY_STATUS_MAP: Record<string, { sub: SubStatus; org: OrgStatus }> = {
  active: { sub: "active", org: "active" },
  pending: { sub: "past_due", org: "past_due" },
  halted: { sub: "past_due", org: "past_due" },
  cancelled: { sub: "cancelled", org: "cancelled" },
  completed: { sub: "expired", org: "cancelled" },
  expired: { sub: "expired", org: "cancelled" },
};

/** Events that mean a payment didn't go through (staff are alerted once per event). */
export const PAYMENT_FAILED_EVENTS = ["subscription.pending", "subscription.halted", "payment.failed"];

export function mappingFor(type: string, entityStatus: string | undefined): { sub: SubStatus; org: OrgStatus } | undefined {
  if (type === "subscription.updated") return entityStatus ? RAZORPAY_STATUS_MAP[entityStatus] : undefined;
  return RAZORPAY_EVENT_MAP[type];
}

export type WebhookResult =
  | { status: "invalid_signature" }
  | { status: "invalid_payload" }
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventId: string; reason: string }
  | { status: "processed"; eventId: string; organizationId: string };

interface RazorpayPaymentEntity {
  id?: string;
  amount?: number;
  currency?: string;
  error_description?: string | null;
  error_reason?: string | null;
  notes?: Record<string, string> | null;
  subscription_id?: string | null;
}

interface RazorpayEventBody {
  event?: string;
  payload?: { subscription?: { entity?: RazorpaySubscription }; payment?: { entity?: RazorpayPaymentEntity } };
}

const toDate = (s?: number | null) => (s ? new Date(s * 1000) : null);

type Tx = Prisma.TransactionClient;
type Mapping = { sub: SubStatus; org: OrgStatus };

/**
 * Applies one Razorpay subscription's state to our Subscription + Organization rows (inside a transaction).
 * Used by the signed webhook and by the server-side sync (src/lib/billing/sync.ts), which reads the
 * subscription straight from the Razorpay API — never from the browser.
 */
export async function applySubscriptionEntity(
  tx: Tx,
  entity: RazorpaySubscription,
  mapping: Mapping,
  action: string,
): Promise<{ ok: true; organizationId: string } | { ok: false; reason: string }> {
  const existing = await tx.subscription.findUnique({ where: { providerSubscriptionId: entity.id } });
  const noteOrg = entity.notes?.organizationId;
  const organizationId = existing?.organizationId ?? (typeof noteOrg === "string" ? noteOrg : null);
  if (!organizationId) return { ok: false, reason: "subscription not linked to an organization" };
  const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, planId: true, status: true } });
  if (!org) return { ok: false, reason: "organization not found" };

  const notePlan = entity.notes?.planId;
  const planId =
    planIdFromRazorpayPlan(entity.plan_id) ??
    (typeof notePlan === "string" && isPlanId(notePlan) && notePlan !== "trial" ? notePlan : null) ??
    existing?.planId ??
    org.planId;

  const subData = {
    planId,
    status: mapping.sub,
    currentPeriodStart: toDate(entity.current_start) ?? existing?.currentPeriodStart ?? null,
    currentPeriodEnd: toDate(entity.current_end) ?? existing?.currentPeriodEnd ?? null,
  };
  if (existing) {
    await tx.subscription.update({ where: { id: existing.id }, data: subData });
  } else {
    await tx.subscription.create({
      data: { ...subData, organizationId, provider: "razorpay", providerSubscriptionId: entity.id },
    });
  }
  if (mapping.sub === "active") {
    // Paid subscription supersedes the trial.
    await tx.subscription.updateMany({ where: { organizationId, status: "trialing" }, data: { status: "expired" } });
  }
  // An old subscription ending (or failing) must not downgrade an org that has a newer active subscription.
  const supersededBy =
    mapping.sub === "active"
      ? null
      : await tx.subscription.findFirst({
          where: { organizationId, status: "active", NOT: { providerSubscriptionId: entity.id } },
          select: { id: true },
        });
  if (!supersededBy) {
    await tx.organization.update({
      where: { id: organizationId },
      data: { status: mapping.org, ...(mapping.sub === "active" ? { planId } : {}) },
    });
  }
  await tx.auditLog.create({
    data: {
      organizationId,
      actorType: "system",
      action,
      resourceType: "subscription",
      resourceId: entity.id,
      before: { planId: org.planId, status: org.status },
      after: supersededBy
        ? { planId: org.planId, status: org.status, note: "superseded subscription; organization unchanged" }
        : { planId: mapping.sub === "active" ? planId : org.planId, status: mapping.org },
    },
  });
  return { ok: true, organizationId };
}

export async function processRazorpayWebhook(
  rawBody: string,
  headers: { signature: string | null; eventId: string | null },
  secret = process.env.RAZORPAY_WEBHOOK_SECRET,
): Promise<WebhookResult> {
  if (!verifyRazorpaySignature(rawBody, headers.signature, secret)) return { status: "invalid_signature" };

  let body: RazorpayEventBody;
  try {
    body = JSON.parse(rawBody) as RazorpayEventBody;
  } catch {
    return { status: "invalid_payload" };
  }
  const type = typeof body.event === "string" ? body.event : "unknown";
  // Razorpay sends X-Razorpay-Event-Id; fall back to a body digest so identical replays are still caught.
  const eventId = headers.eventId || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  const entity = body.payload?.subscription?.entity;
  const mapping = mappingFor(type, entity?.status);

  let result: WebhookResult;
  try {
    result = await db.$transaction(async (tx) => {
      // Insert first: unique(provider,eventId) makes concurrent/replayed deliveries fail with P2002.
      await tx.webhookEvent.create({
        data: { provider: "razorpay", eventId, type, payload: body as unknown as Prisma.InputJsonValue },
      });
      if (!mapping || !entity?.id) return { status: "ignored", eventId, reason: `unhandled event ${type}` } as const;

      const applied = await applySubscriptionEntity(tx, entity, mapping, `billing.${type}`);
      if (!applied.ok) return { status: "ignored", eventId, reason: applied.reason } as const;
      return { status: "processed", eventId, organizationId: applied.organizationId } as const;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "duplicate", eventId };
    }
    throw err;
  }
  if (PAYMENT_FAILED_EVENTS.includes(type)) await alertPaymentFailed(type, eventId, body, result);
  // Referral: a paid subscription went active → one free month for the referrer (idempotent; never fails the webhook).
  if (result.status === "processed" && mapping?.sub === "active") await applyReferralReward(result.organizationId).catch(() => undefined);
  return result;
}

/** Best-effort read for alert context: a lookup failure must never stop the alert. */
async function lookup<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}

/** Staff alert for a failed payment (after the event is stored; duplicates never reach here). Never throws. */
async function alertPaymentFailed(type: string, eventId: string, body: RazorpayEventBody, result: WebhookResult): Promise<void> {
  try {
    const payment = body.payload?.payment?.entity;
    const sub = body.payload?.subscription?.entity;
    let organizationId = result.status === "processed" ? result.organizationId : null;
    const subId = sub?.id ?? payment?.subscription_id ?? null;
    if (!organizationId && subId) {
      organizationId = (await lookup(() => db.subscription.findUnique({ where: { providerSubscriptionId: subId }, select: { organizationId: true } })))?.organizationId ?? null;
    }
    organizationId ??= (typeof payment?.notes?.organizationId === "string" ? payment.notes.organizationId : null) ?? (typeof sub?.notes?.organizationId === "string" ? sub.notes.organizationId : null);
    const orgId = organizationId;
    const org = orgId ? await lookup(() => db.organization.findUnique({ where: { id: orgId }, select: { name: true, planId: true } })) : null;
    const amount = typeof payment?.amount === "number" ? ` of ${(payment.amount / 100).toLocaleString("en-IN")} ${payment.currency ?? "INR"}` : "";
    const reason = payment?.error_description || payment?.error_reason;
    await sendStaffAlert({
      kind: "payment_failed",
      key: eventId,
      organizationId,
      subject: `Payment failed${org ? `: ${org.name}` : ""} (${type})`,
      text: [
        `Razorpay sent ${type}${amount}.`,
        org ? `Organization: ${org.name} (${organizationId}), plan ${org.planId}.` : organizationId ? `Organization: ${organizationId}.` : "Not linked to an organization.",
        subId ? `Subscription: ${subId}.` : "",
        reason ? `Reason: ${reason}` : "",
        type === "payment.failed" ? "" : "Checks stay on for the grace period, then pause until the payment goes through.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  } catch (err) {
    console.warn("[billing] payment-failed alert failed", (err as Error)?.name);
  }
}
