// Razorpay webhook processing: verify signature -> idempotency (WebhookEvent unique) -> map to Subscription/Organization.
// Billing state is changed ONLY here (signed server-to-server events); client checkout redirects are never trusted.
//
// Also handled here:
//   - AI-answer top-ups (one-time Razorpay ORDERS): `order.paid` (or `payment.captured` with an order_id) grants the
//     pack — idempotent, and only when the paid amount equals the stored order total; `payment.failed` with an
//     order_id marks the order failed; `refund.processed` takes back the pack's unused answers (never negative).
//   - GST invoices (src/lib/billing/invoice.ts, idempotent per payment) for `subscription.charged` (base derived from
//     the charged amount and the GST rate) and for paid top-ups. Created after the event commits; a redelivered
//     (duplicate) event retries a missing invoice.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { getPlan, isPlanId, planIdFromRazorpayPlan } from "./plans";
import { verifyRazorpaySignature, type RazorpaySubscription } from "./razorpay";
import { applyReferralReward } from "@/lib/growth/referral";
import { getAiAllowance } from "./allowance";
import { formatInr, gstFromTotal } from "./gst";
import { createInvoiceForPayment } from "./invoice";
import { getTopUpPack } from "./topups";
import { grantTopUp, markTopUpFailed, refundTopUp, type GrantResult } from "./topup-service";

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
  status?: string;
  order_id?: string | null;
  created_at?: number | null;
  error_description?: string | null;
  error_reason?: string | null;
  notes?: Record<string, string> | null;
  subscription_id?: string | null;
}

interface RazorpayOrderEntity {
  id?: string;
  amount?: number;
  amount_paid?: number;
  currency?: string;
  notes?: Record<string, string> | null;
}

interface RazorpayRefundEntity {
  id?: string;
  payment_id?: string;
  amount?: number;
}

interface RazorpayEventBody {
  event?: string;
  payload?: {
    subscription?: { entity?: RazorpaySubscription };
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayOrderEntity };
    refund?: { entity?: RazorpayRefundEntity };
  };
}

/** Events that may pay a top-up order. */
export const TOPUP_PAID_EVENTS = ["order.paid", "payment.captured"];

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
  const payment = body.payload?.payment?.entity;
  const order = body.payload?.order?.entity;
  const refund = body.payload?.refund?.entity;
  const topUpOrderId = TOPUP_PAID_EVENTS.includes(type) || type === "payment.failed" ? (order?.id ?? payment?.order_id ?? null) : null;
  // A refund needs the pack's unused answers right now (read before the transaction; this also settles closed months).
  const unusedNow = type === "refund.processed" && refund?.payment_id ? await unusedAnswersForPayment(refund.payment_id) : 0;

  let grant: GrantResult | null = null;
  let result: WebhookResult;
  try {
    result = await db.$transaction(async (tx) => {
      // Insert first: unique(provider,eventId) makes concurrent/replayed deliveries fail with P2002.
      await tx.webhookEvent.create({
        data: { provider: "razorpay", eventId, type, payload: body as unknown as Prisma.InputJsonValue },
      });

      if (TOPUP_PAID_EVENTS.includes(type) && topUpOrderId && payment?.id) {
        const amount = typeof payment.amount === "number" ? payment.amount : typeof order?.amount_paid === "number" ? order.amount_paid : -1;
        const g = await grantTopUp(tx, {
          razorpayOrderId: topUpOrderId,
          razorpayPaymentId: payment.id,
          amountPaise: amount,
          currency: payment.currency ?? order?.currency ?? null,
          noteOrganizationId: order?.notes?.organizationId ?? payment.notes?.organizationId ?? null,
        });
        grant = g;
        if (g.ok) return { status: "processed", eventId, organizationId: g.organizationId } as const;
        if (g.reason !== "not_topup") return { status: "ignored", eventId, reason: `top-up ${g.reason}` } as const;
      }
      if (type === "payment.failed" && topUpOrderId) {
        const orgId = await markTopUpFailed(tx, topUpOrderId, payment?.error_description ?? payment?.error_reason ?? null);
        if (orgId) return { status: "ignored", eventId, reason: "top-up payment failed" } as const;
      }
      if (type === "refund.processed" && refund?.payment_id) {
        const r = await refundTopUp(tx, { razorpayPaymentId: refund.payment_id, refundPaise: refund.amount ?? 0, unusedNow });
        if (r.ok) return { status: "processed", eventId, organizationId: r.organizationId } as const;
      }

      if (!mapping || !entity?.id) return { status: "ignored", eventId, reason: `unhandled event ${type}` } as const;

      const applied = await applySubscriptionEntity(tx, entity, mapping, `billing.${type}`);
      if (!applied.ok) return { status: "ignored", eventId, reason: applied.reason } as const;
      return { status: "processed", eventId, organizationId: applied.organizationId } as const;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // A redelivery: the state change is done, but make sure its invoice exists (idempotent per payment).
      await ensureInvoiceAfterDuplicate(type, body, topUpOrderId);
      return { status: "duplicate", eventId };
    }
    throw err;
  }
  if (PAYMENT_FAILED_EVENTS.includes(type)) await alertPaymentFailed(type, eventId, body, result);
  // Referral: a paid subscription went active → one free month for the referrer (idempotent; never fails the webhook).
  if (result.status === "processed" && mapping?.sub === "active") await applyReferralReward(result.organizationId).catch(() => undefined);

  const g = grant as GrantResult | null;
  if (g?.ok && payment?.id) {
    await invoiceTopUp(g.organizationId, payment.id, g, paidAtOf(payment));
    await alertTopUpPaid(eventId, g, payment.id);
  } else if (g && !g.ok && g.reason === "amount_mismatch") {
    await safeAlert({
      kind: "topup_amount_mismatch",
      key: eventId,
      organizationId: g.organizationId ?? null,
      subject: "Top-up payment amount didn't match — answers NOT added",
      text: `Razorpay reported ${formatInr(g.got ?? 0)} for top-up order ${topUpOrderId}, but the order total is ${formatInr(g.expected ?? 0)}. No answers were added. Check the payment in Razorpay, then refund it or add the answers by hand.`,
    });
  }
  if (type === "subscription.charged" && result.status === "processed" && payment?.id && typeof payment.amount === "number") {
    await invoiceSubscriptionCharge(result.organizationId, payment, entity);
  }
  return result;
}

const paidAtOf = (p?: RazorpayPaymentEntity) => (p?.created_at ? new Date(p.created_at * 1000) : new Date());

/** Unused answers of the top-up pack bought with this payment (0 when it isn't a top-up). Never throws. */
async function unusedAnswersForPayment(paymentId: string): Promise<number> {
  try {
    const pack = await db.topUpPack.findUnique({ where: { razorpayPaymentId: paymentId }, select: { id: true, organizationId: true } });
    if (!pack) return 0;
    const a = await getAiAllowance(pack.organizationId);
    return a.extra.packs.find((p) => p.id === pack.id)?.left ?? 0;
  } catch (e) {
    console.warn("[billing] refund: could not read unused answers", (e as Error)?.name);
    return 0;
  }
}

async function safeAlert(a: Parameters<typeof sendStaffAlert>[0]): Promise<void> {
  try {
    await sendStaffAlert(a);
  } catch (err) {
    console.warn("[billing] staff alert failed", (err as Error)?.name);
  }
}

/** Invoice for a paid top-up. An invoice failure never fails the webhook: staff are told, a redelivery retries. */
async function invoiceTopUp(
  organizationId: string,
  paymentId: string,
  o: { basePaise: number; gstPaise: number; totalPaise: number; packId: string; answers: number },
  paidAt: Date,
): Promise<void> {
  try {
    await createInvoiceForPayment({
      organizationId,
      kind: "topup",
      razorpayPaymentId: paymentId,
      description: `${getTopUpPack(o.packId)?.name ?? `${o.answers} extra AI answers`} (one-time top-up)`,
      basePaise: o.basePaise,
      gstPaise: o.gstPaise,
      totalPaise: o.totalPaise,
      paidAt,
    });
  } catch (err) {
    console.error("[billing] top-up invoice failed", (err as Error)?.name);
    await safeAlert({
      kind: "invoice_failed",
      key: paymentId,
      organizationId,
      subject: "Invoice not created for a top-up payment",
      text: `The GST invoice for payment ${paymentId} could not be created. The answers were added. Create the invoice by hand, or it is retried when Razorpay redelivers the event.`,
    });
  }
}

/** Invoice for a subscription charge: base = charged amount ÷ (1 + GST rate), GST = the rest. Never throws. */
async function invoiceSubscriptionCharge(organizationId: string, payment: RazorpayPaymentEntity, sub?: RazorpaySubscription): Promise<void> {
  if (!payment.id || typeof payment.amount !== "number") return;
  try {
    const subId = sub?.id ?? payment.subscription_id ?? null;
    const row = subId ? await lookup(() => db.subscription.findUnique({ where: { providerSubscriptionId: subId }, select: { planId: true } })) : null;
    const b = gstFromTotal(payment.amount);
    await createInvoiceForPayment({
      organizationId,
      kind: "subscription",
      razorpayPaymentId: payment.id,
      description: row ? `${getPlan(row.planId).name} plan — monthly subscription` : "Monthly subscription",
      basePaise: b.basePaise,
      gstPaise: b.gstPaise,
      totalPaise: b.totalPaise,
      paidAt: paidAtOf(payment),
    });
  } catch (err) {
    console.error("[billing] subscription invoice failed", (err as Error)?.name);
    await safeAlert({
      kind: "invoice_failed",
      key: payment.id,
      organizationId,
      subject: "Invoice not created for a subscription payment",
      text: `The GST invoice for subscription payment ${payment.id} could not be created. Create it by hand, or it is retried when Razorpay redelivers the event.`,
    });
  }
}

/** Redelivered invoice-bearing event: create the invoice if the first delivery couldn't. Never throws. */
async function ensureInvoiceAfterDuplicate(type: string, body: RazorpayEventBody, topUpOrderId: string | null): Promise<void> {
  const payment = body.payload?.payment?.entity;
  if (!payment?.id || !(TOPUP_PAID_EVENTS.includes(type) || type === "subscription.charged")) return;
  const paymentId = payment.id;
  try {
    if (await db.invoice.findUnique({ where: { razorpayPaymentId: paymentId }, select: { id: true } })) return;
    if (TOPUP_PAID_EVENTS.includes(type) && topUpOrderId) {
      const o = await db.topUpOrder.findUnique({ where: { razorpayOrderId: topUpOrderId } });
      if (o && (o.status === "paid" || o.status === "refunded") && o.razorpayPaymentId === paymentId) {
        await invoiceTopUp(o.organizationId, paymentId, o, o.paidAt ?? paidAtOf(payment));
      }
    } else if (type === "subscription.charged") {
      const sub = body.payload?.subscription?.entity;
      const row = sub?.id ? await db.subscription.findUnique({ where: { providerSubscriptionId: sub.id }, select: { organizationId: true } }) : null;
      if (row) await invoiceSubscriptionCharge(row.organizationId, payment, sub);
    }
  } catch (err) {
    console.warn("[billing] invoice retry failed", (err as Error)?.name);
  }
}

/** Staff alert for a paid top-up (deduped per payment). Never throws. */
async function alertTopUpPaid(eventId: string, g: Extract<GrantResult, { ok: true }>, paymentId: string): Promise<void> {
  const org = await lookup(() => db.organization.findUnique({ where: { id: g.organizationId }, select: { name: true, planId: true } }));
  await safeAlert({
    kind: "topup_paid",
    key: paymentId,
    organizationId: g.organizationId,
    subject: `Top-up paid${org ? `: ${org.name}` : ""} — ${g.answers.toLocaleString("en-IN")} AI answers`,
    text: [
      `${org?.name ?? g.organizationId} bought ${g.answers.toLocaleString("en-IN")} extra AI answers for ${formatInr(g.totalPaise)} (${formatInr(g.basePaise)} + ${formatInr(g.gstPaise)} GST).`,
      org ? `Plan: ${getPlan(org.planId).name}.` : "",
      `Payment: ${paymentId}. Event: ${eventId}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
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
