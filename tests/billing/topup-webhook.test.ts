import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const state = vi.hoisted(() => ({
  events: new Set<string>(),
  orders: [] as Record<string, unknown>[],
  packs: [] as Record<string, unknown>[],
  invoices: [] as Record<string, unknown>[],
  alerts: [] as { kind: string; key: string }[],
  notifications: 0,
  unused: 0,
}));

vi.mock("@/lib/db", () => {
  const p2002 = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
  const tx = {
    webhookEvent: {
      create: vi.fn(async ({ data }: { data: { eventId: string } }) => {
        if (state.events.has(data.eventId)) throw p2002();
        state.events.add(data.eventId);
        return data;
      }),
    },
    topUpOrder: {
      findUnique: vi.fn(async ({ where }: { where: { razorpayOrderId?: string; id?: string } }) =>
        state.orders.find((o) => (where.razorpayOrderId ? o.razorpayOrderId === where.razorpayOrderId : o.id === where.id)) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(state.orders.find((o) => o.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string | { in: string[] } }; data: Record<string, unknown> }) => {
        const ok = (s: string) => (typeof where.status === "string" ? where.status === s : where.status.in.includes(s));
        const o = state.orders.find((x) => x.id === where.id && ok(x.status as string));
        if (!o) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      }),
    },
    topUpPack: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (state.packs.some((p) => p.orderId === data.orderId)) throw p2002();
        const row = { id: `pack_${state.packs.length + 1}`, status: "paid", consumed: 0, revokedAnswers: 0, ...data };
        state.packs.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { razorpayPaymentId: string } }) => state.packs.find((p) => p.razorpayPaymentId === where.razorpayPaymentId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(state.packs.find((p) => p.id === where.id)!, data)),
    },
    subscription: { findUnique: vi.fn(async () => null) },
    organization: { findUnique: vi.fn(async () => ({ name: "Acme", planId: "starter" })) },
    auditLog: { create: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => void state.notifications++) },
    invoice: { findUnique: vi.fn(async ({ where }: { where: { razorpayPaymentId: string } }) => state.invoices.find((i) => i.razorpayPaymentId === where.razorpayPaymentId) ?? null) },
  };
  return { db: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } };
});

vi.mock("@/lib/billing/invoice", () => ({
  createInvoiceForPayment: vi.fn(async (i: Record<string, unknown>) => {
    if (!state.invoices.some((x) => x.razorpayPaymentId === i.razorpayPaymentId)) state.invoices.push(i);
    return i;
  }),
}));
vi.mock("@/lib/alerts/staff", () => ({
  sendStaffAlert: vi.fn(async (a: { kind: string; key: string }) => {
    state.alerts.push(a);
    return { status: "sent" };
  }),
}));
vi.mock("@/lib/billing/allowance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/allowance")>()),
  getAiAllowance: vi.fn(async () => ({ extra: { packs: state.packs.map((p) => ({ id: p.id, left: state.unused })) } })),
}));
vi.mock("@/lib/growth/referral", () => ({ applyReferralReward: vi.fn(async () => undefined) }));

import { processRazorpayWebhook } from "@/lib/billing/webhook";
import { verifyCheckoutSignature } from "@/lib/billing/razorpay-orders";

const SECRET = "whsec_topup";
const sign = (b: string) => createHmac("sha256", SECRET).update(b).digest("hex");
const send = (body: string, id: string | null) => processRazorpayWebhook(body, { signature: sign(body), eventId: id }, SECRET);

const orderPaid = (amount = 82_482, payId = "pay_1") =>
  JSON.stringify({
    event: "order.paid",
    payload: {
      order: { entity: { id: "order_1", amount: 82_482, amount_paid: amount, currency: "INR", notes: { organizationId: "org_1", packId: "answers_100" } } },
      payment: { entity: { id: payId, amount, currency: "INR", order_id: "order_1", status: "captured", created_at: 1_794_000_000 } },
    },
  });

beforeEach(() => {
  state.events = new Set();
  state.packs = [];
  state.invoices = [];
  state.alerts = [];
  state.notifications = 0;
  state.unused = 0;
  state.orders = [
    { id: "o1", organizationId: "org_1", packId: "answers_100", answers: 100, basePaise: 69_900, gstPaise: 12_582, totalPaise: 82_482, razorpayOrderId: "order_1", status: "pending", refundedPaise: 0, razorpayPaymentId: null, paidAt: null },
  ];
});

describe("top-up webhook", () => {
  it("order.paid grants the pack once, creates the invoice and alerts staff", async () => {
    const res = await send(orderPaid(), "evt_1");
    expect(res).toMatchObject({ status: "processed", organizationId: "org_1" });
    expect(state.orders[0]).toMatchObject({ status: "paid", razorpayPaymentId: "pay_1" });
    expect(state.packs).toHaveLength(1);
    expect(state.packs[0]).toMatchObject({ organizationId: "org_1", answers: 100, basePaise: 69_900, razorpayPaymentId: "pay_1" });
    const purchased = state.packs[0].purchasedAt as Date;
    expect((state.packs[0].expiresAt as Date).getUTCFullYear()).toBe(purchased.getUTCFullYear() + 1);
    expect(state.invoices).toEqual([expect.objectContaining({ kind: "topup", razorpayPaymentId: "pay_1", basePaise: 69_900, gstPaise: 12_582, totalPaise: 82_482 })]);
    expect(state.alerts.map((a) => a.kind)).toEqual(["topup_paid"]);
    expect(state.notifications).toBe(1);
  });

  it("a duplicate event, or payment.captured for the same order, never grants twice", async () => {
    await send(orderPaid(), "evt_1");
    expect((await send(orderPaid(), "evt_1")).status).toBe("duplicate");
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", amount: 82_482, currency: "INR", order_id: "order_1" } } } });
    expect(await send(captured, "evt_2")).toMatchObject({ status: "ignored", reason: "top-up already_granted" });
    expect(state.packs).toHaveLength(1);
    expect(state.invoices).toHaveLength(1);
  });

  it("payment.captured alone (order.paid not enabled) also grants", async () => {
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_9", amount: 82_482, currency: "INR", order_id: "order_1" } } } });
    expect((await send(captured, "evt_c")).status).toBe("processed");
    expect(state.packs).toHaveLength(1);
  });

  it("a wrong amount grants nothing and alerts staff", async () => {
    const res = await send(orderPaid(100), "evt_w");
    expect(res).toMatchObject({ status: "ignored", reason: "top-up amount_mismatch" });
    expect(state.packs).toHaveLength(0);
    expect(state.orders[0].status).toBe("pending");
    expect(state.invoices).toHaveLength(0);
    expect(state.alerts.map((a) => a.kind)).toEqual(["topup_amount_mismatch"]);
  });

  it("rejects a bad signature without touching anything", async () => {
    const body = orderPaid();
    expect((await processRazorpayWebhook(body, { signature: "00", eventId: "x" }, SECRET)).status).toBe("invalid_signature");
    expect(state.events.size).toBe(0);
    expect(state.packs).toHaveLength(0);
  });

  it("payment.failed marks a pending top-up order failed", async () => {
    const body = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_f", amount: 82_482, order_id: "order_1", error_description: "Card declined" } } } });
    await send(body, "evt_f");
    expect(state.orders[0]).toMatchObject({ status: "failed" });
    expect(state.packs).toHaveLength(0);
  });

  it("refund.processed takes back only the unused answers (never negative)", async () => {
    await send(orderPaid(), "evt_1");
    state.unused = 40;
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 82_482 } } } });
    expect((await send(refund, "evt_r")).status).toBe("processed");
    expect(state.packs[0]).toMatchObject({ status: "refunded", revokedAnswers: 40 });
    expect(state.orders[0]).toMatchObject({ status: "refunded", refundedPaise: 82_482 });
  });

  it("refund after every answer was used leaves the pack as it is", async () => {
    await send(orderPaid(), "evt_1");
    state.unused = 0;
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_2", payment_id: "pay_1", amount: 82_482 } } } });
    await send(refund, "evt_r2");
    expect(state.packs[0]).toMatchObject({ status: "paid", revokedAnswers: 0 });
  });

  it("subscription.charged creates a GST invoice with base derived from the charged amount", async () => {
    vi.stubEnv("GSTIN", "07AAACB1234C1Z5");
    vi.stubEnv("GST_RATE_PERCENT", "18");
    const body = JSON.stringify({
      event: "subscription.charged",
      payload: {
        subscription: { entity: { id: "sub_1", plan_id: "plan_x", status: "active", notes: { organizationId: "org_1", planId: "starter" } } },
        payment: { entity: { id: "pay_s1", amount: 235_882, currency: "INR", subscription_id: "sub_1" } },
      },
    });
    // applySubscriptionEntity needs a few more tx methods; stub them on the mocked db for this test.
    const { db } = await import("@/lib/db");
    const d = db as unknown as Record<string, Record<string, unknown>>;
    d.subscription.create = vi.fn(async () => ({}));
    d.subscription.updateMany = vi.fn(async () => ({ count: 0 }));
    d.organization.update = vi.fn(async () => ({}));
    expect((await send(body, "evt_s")).status).toBe("processed");
    expect(state.invoices).toEqual([expect.objectContaining({ kind: "subscription", razorpayPaymentId: "pay_s1", basePaise: 199_900, gstPaise: 35_982, totalPaise: 235_882 })]);
    vi.unstubAllEnvs();
  });
});

describe("checkout signature (display only)", () => {
  it("is HMAC-SHA256 of order_id|payment_id with the key secret", () => {
    const sig = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig }, "key_secret")).toBe(true);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature: sig }, "key_secret")).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig }, undefined)).toBe(false);
  });
});
