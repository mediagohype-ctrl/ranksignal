// AI-answer top-ups: offer (prices + GST), checkout (Razorpay order), history, and the webhook-side grant/refund.
// Server-only. Answers are granted ONLY from the signed webhook (grantTopUp, called inside the webhook transaction).
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { accessMessage, getOrgAccess } from "./access";
import { getAiAllowance, utcMonthStart } from "./allowance";
import { formatInr, priceWithGst } from "./gst";
import { isRazorpayConfigured } from "./razorpay";
import { createRazorpayOrder } from "./razorpay-orders";
import { TOPUP_VALIDITY_MONTHS, getTopUpPack, offeredTopUpPacks, topUpExpiry, type TopUpPackId } from "./topups";

/** Pending orders one workspace may open per hour (stops checkout spam creating hundreds of Razorpay orders). */
export const MAX_PENDING_TOPUP_ORDERS_PER_HOUR = 10;

export interface TopUpOffer {
  id: TopUpPackId;
  name: string;
  answers: number;
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  ratePercent: number;
  /** "₹699 + ₹125.82 GST = ₹824.82" (or just "₹699" when GST doesn't apply). */
  priceLabel: string;
  validityMonths: number;
}

async function customerStateCode(orgId: string): Promise<string | null> {
  const d = await db.billingDetails.findUnique({ where: { organizationId: orgId }, select: { stateCode: true } }).catch(() => null);
  return d?.stateCode ?? null;
}

export function offerFor(id: TopUpPackId, stateCode: string | null): TopUpOffer {
  const p = getTopUpPack(id)!;
  const b = priceWithGst(p.pricePaise, { customerStateCode: stateCode });
  return {
    id: p.id,
    name: p.name,
    answers: p.answers,
    basePaise: b.basePaise,
    gstPaise: b.gstPaise,
    totalPaise: b.totalPaise,
    ratePercent: b.ratePercent,
    priceLabel: b.gstPaise > 0 ? `${formatInr(b.basePaise)} + ${formatInr(b.gstPaise)} GST = ${formatInr(b.totalPaise)}` : formatInr(b.totalPaise),
    validityMonths: TOPUP_VALIDITY_MONTHS,
  };
}

export async function getTopUpOffers(orgId: string): Promise<TopUpOffer[]> {
  const state = await customerStateCode(orgId);
  return offeredTopUpPacks().map((p) => offerFor(p.id, state));
}

export type TopUpOrderStatus = "pending" | "paid" | "failed" | "refunded";

export interface TopUpOverview {
  offers: TopUpOffer[];
  checkoutAvailable: boolean;
  trial: boolean;
  accessActive: boolean;
  extraLeft: number;
  extraExpiresAt: string | null;
  packs: { id: string; name: string; answers: number; left: number; purchasedAt: string; expiresAt: string; status: "active" | "used" | "expired" | "refunded" }[];
  orders: { id: string; razorpayOrderId: string; name: string; answers: number; totalPaise: number; status: TopUpOrderStatus; createdAt: string; paidAt: string | null }[];
}

/** Everything the "Extra AI answers" card and the buy dialog need. */
export async function getTopUpOverview(orgId: string, now = new Date()): Promise<TopUpOverview> {
  const [offers, access, allowance, packs, orders] = await Promise.all([
    getTopUpOffers(orgId),
    getOrgAccess(orgId, now),
    getAiAllowance(orgId, { now }),
    db.topUpPack.findMany({ where: { organizationId: orgId }, orderBy: { purchasedAt: "desc" }, take: 50 }),
    db.topUpOrder.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const leftById = new Map(allowance.extra.packs.map((p) => [p.id, p.left]));
  const name = (packId: string, answers: number) => getTopUpPack(packId)?.name ?? `${answers.toLocaleString("en-IN")} extra AI answers`;
  return {
    offers,
    checkoutAvailable: isRazorpayConfigured(),
    trial: access.planId === "trial",
    accessActive: access.active,
    extraLeft: allowance.extra.left,
    extraExpiresAt: allowance.extra.expiresAt?.toISOString() ?? null,
    packs: packs.map((p) => {
      const left = leftById.get(p.id) ?? 0;
      const status = p.status === "refunded" ? "refunded" : p.expiresAt <= now ? "expired" : left > 0 ? "active" : "used";
      return { id: p.id, name: name(p.packId, p.answers), answers: p.answers, left, purchasedAt: p.purchasedAt.toISOString(), expiresAt: p.expiresAt.toISOString(), status };
    }),
    orders: orders
      // An order that was opened but never paid (closed checkout) stays out of the history after a day.
      .filter((o) => o.status !== "pending" || now.getTime() - o.createdAt.getTime() < 24 * 60 * 60 * 1000)
      .map((o) => ({
        id: o.id,
        razorpayOrderId: o.razorpayOrderId,
        name: name(o.packId, o.answers),
        answers: o.answers,
        totalPaise: o.totalPaise,
        status: o.status as TopUpOrderStatus,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
      })),
  };
}

/** Creates the Razorpay order + a pending TopUpOrder row. Caller has checked owner/admin. */
export async function startTopUpCheckout(o: { organizationId: string; userId: string; packId: TopUpPackId }) {
  const access = await getOrgAccess(o.organizationId);
  if (!access.active) {
    throw new HttpError(402, "plan_inactive", `${accessMessage(access)} Extra AI answers can only be used while your plan is active.`, {
      reason: access.reason,
      upgradeUrl: "/app/settings?tab=billing",
    });
  }
  if (!isRazorpayConfigured()) {
    throw new HttpError(501, "billing_not_configured", `Payments are coming soon. Contact ${BRAND.supportEmail} to buy extra AI answers.`);
  }
  const recent = await db.topUpOrder.count({
    where: { organizationId: o.organizationId, status: "pending", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_PENDING_TOPUP_ORDERS_PER_HOUR) {
    throw new HttpError(429, "too_many_orders", "You've opened the payment window many times in the last hour. Please wait a little and try again.");
  }
  const pack = offeredTopUpPacks().find((p) => p.id === o.packId);
  if (!pack) throw new HttpError(400, "pack_unavailable", "That pack isn't available. Please pick another one.");
  const offer = offerFor(pack.id, await customerStateCode(o.organizationId));
  const receipt = `topup_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  let order;
  try {
    order = await createRazorpayOrder({
      amountPaise: offer.totalPaise,
      receipt,
      notes: { organizationId: o.organizationId, packId: pack.id, kind: "topup" },
    });
  } catch {
    throw new HttpError(502, "billing_provider_error", "Could not start the payment. Please try again.");
  }
  if (order.amount !== offer.totalPaise) {
    console.error("[billing] razorpay order amount mismatch", order.amount, offer.totalPaise);
    throw new HttpError(502, "billing_provider_error", "Could not start the payment. Please try again.");
  }
  const row = await db.topUpOrder.create({
    data: {
      organizationId: o.organizationId,
      packId: pack.id,
      answers: pack.answers,
      basePaise: offer.basePaise,
      gstPaise: offer.gstPaise,
      totalPaise: offer.totalPaise,
      ratePercent: offer.ratePercent,
      razorpayOrderId: order.id,
      receipt,
      createdById: o.userId,
    },
  });
  await db.auditLog
    .create({
      data: {
        organizationId: o.organizationId,
        actorId: o.userId,
        actorType: "user",
        action: "billing.topup_checkout_started",
        resourceType: "topup_order",
        resourceId: row.id,
        after: { packId: pack.id, totalPaise: offer.totalPaise, razorpayOrderId: order.id },
      },
    })
    .catch(() => undefined);
  return { orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID ?? "", amount: offer.totalPaise, currency: "INR", pack: offer, breakdown: offer };
}

// ---------------------------------------------------------------------------------------------------- webhook side

type Tx = Prisma.TransactionClient;

export type GrantResult =
  | { ok: true; organizationId: string; packId: string; answers: number; totalPaise: number; basePaise: number; gstPaise: number; topUpPackRowId: string; already?: false }
  | { ok: false; reason: "not_topup" | "already_granted" | "amount_mismatch" | "org_mismatch" | "currency"; organizationId?: string; expected?: number; got?: number };

/**
 * Grants a paid top-up order (inside the webhook transaction). Idempotent: an order already paid is not granted
 * again (order.paid and payment.captured both arrive for one payment). The paid amount must equal the stored total.
 */
export async function grantTopUp(
  tx: Tx,
  p: { razorpayOrderId: string; razorpayPaymentId: string; amountPaise: number; currency?: string | null; noteOrganizationId?: string | null; now?: Date },
): Promise<GrantResult> {
  const now = p.now ?? new Date();
  const order = await tx.topUpOrder.findUnique({ where: { razorpayOrderId: p.razorpayOrderId } });
  if (!order) return { ok: false, reason: "not_topup" };
  if (order.status === "paid" || order.status === "refunded") return { ok: false, reason: "already_granted", organizationId: order.organizationId };
  if (p.noteOrganizationId && p.noteOrganizationId !== order.organizationId) return { ok: false, reason: "org_mismatch", organizationId: order.organizationId };
  if (p.currency && p.currency !== "INR") return { ok: false, reason: "currency", organizationId: order.organizationId };
  if (p.amountPaise !== order.totalPaise) {
    await tx.topUpOrder.update({ where: { id: order.id }, data: { failureReason: `amount_mismatch:${p.amountPaise}` } });
    return { ok: false, reason: "amount_mismatch", organizationId: order.organizationId, expected: order.totalPaise, got: p.amountPaise };
  }
  // Conditional update: only one delivery can move pending/failed → paid.
  const moved = await tx.topUpOrder.updateMany({
    where: { id: order.id, status: { in: ["pending", "failed"] } },
    data: { status: "paid", paidAt: now, razorpayPaymentId: p.razorpayPaymentId, failureReason: null },
  });
  if (moved.count === 0) return { ok: false, reason: "already_granted", organizationId: order.organizationId };
  const pack = await tx.topUpPack.create({
    data: {
      organizationId: order.organizationId,
      orderId: order.id,
      packId: order.packId,
      answers: order.answers,
      basePaise: order.basePaise,
      razorpayPaymentId: p.razorpayPaymentId,
      purchasedAt: now,
      expiresAt: topUpExpiry(now),
      settledThrough: utcMonthStart(now),
    },
  });
  await tx.auditLog.create({
    data: {
      organizationId: order.organizationId,
      actorType: "system",
      action: "billing.topup_paid",
      resourceType: "topup_pack",
      resourceId: pack.id,
      after: { packId: order.packId, answers: order.answers, totalPaise: order.totalPaise, razorpayPaymentId: p.razorpayPaymentId, expiresAt: pack.expiresAt.toISOString() },
    },
  });
  await tx.notification.create({
    data: {
      organizationId: order.organizationId,
      type: "topup_added",
      title: `${order.answers.toLocaleString("en-IN")} extra AI answers added`,
      body: `Thanks for your payment. Your extra AI answers are ready and are used after this month's plan answers run out. They're valid until ${pack.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.`,
      link: "/app/settings?tab=billing",
    },
  });
  return {
    ok: true,
    organizationId: order.organizationId,
    packId: order.packId,
    answers: order.answers,
    totalPaise: order.totalPaise,
    basePaise: order.basePaise,
    gstPaise: order.gstPaise,
    topUpPackRowId: pack.id,
  };
}

/** A payment for a top-up order failed: mark the order (if still pending) so the customer sees it. */
export async function markTopUpFailed(tx: Tx, razorpayOrderId: string, reason: string | null): Promise<string | null> {
  const order = await tx.topUpOrder.findUnique({ where: { razorpayOrderId }, select: { id: true, organizationId: true } });
  if (!order) return null;
  await tx.topUpOrder.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "failed", failureReason: (reason ?? "payment_failed").slice(0, 200) } });
  return order.organizationId;
}

/**
 * Refund of a top-up payment. Unused answers are taken back (pack → refunded, revokedAnswers = what was unused);
 * answers already used stay used, never negative. If nothing is left, the pack stays as it is. `unusedNow` is the
 * pack's left answers worked out just before the transaction (getAiAllowance → extra.packs).
 */
export async function refundTopUp(
  tx: Tx,
  p: { razorpayPaymentId: string; refundPaise: number; unusedNow: number; now?: Date },
): Promise<{ ok: true; organizationId: string; revoked: number; packRowId: string } | { ok: false; reason: string }> {
  const now = p.now ?? new Date();
  const pack = await tx.topUpPack.findUnique({ where: { razorpayPaymentId: p.razorpayPaymentId } });
  if (!pack) return { ok: false, reason: "not_topup" };
  const order = await tx.topUpOrder.findUnique({ where: { id: pack.orderId }, select: { id: true, refundedPaise: true } });
  if (order) {
    await tx.topUpOrder.update({ where: { id: order.id }, data: { status: "refunded", refundedPaise: order.refundedPaise + Math.max(0, Math.round(p.refundPaise)) } });
  }
  let revoked = 0;
  if (pack.status === "paid") {
    const maxUnused = Math.max(0, pack.answers - pack.revokedAnswers - pack.consumed);
    revoked = Math.max(0, Math.min(Math.floor(p.unusedNow), maxUnused));
    if (revoked > 0) {
      await tx.topUpPack.update({ where: { id: pack.id }, data: { status: "refunded", revokedAnswers: pack.revokedAnswers + revoked, refundedAt: now } });
    }
  }
  await tx.auditLog.create({
    data: {
      organizationId: pack.organizationId,
      actorType: "system",
      action: "billing.topup_refunded",
      resourceType: "topup_pack",
      resourceId: pack.id,
      after: { refundPaise: p.refundPaise, revokedAnswers: revoked, note: revoked > 0 ? "unused answers removed" : "no unused answers left; pack unchanged" },
    },
  });
  return { ok: true, organizationId: pack.organizationId, revoked, packRowId: pack.id };
}
