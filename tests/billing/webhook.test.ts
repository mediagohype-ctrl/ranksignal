import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const state = vi.hoisted(() => ({
  events: new Set<string>(),
  subs: [] as Record<string, unknown>[],
  org: { id: "org_1", planId: "trial", status: "active" } as Record<string, unknown>,
  audits: 0,
}));

vi.mock("@/lib/db", () => {
  const tx = {
    webhookEvent: {
      create: vi.fn(async ({ data }: { data: { provider: string; eventId: string } }) => {
        const k = `${data.provider}:${data.eventId}`;
        if (state.events.has(k)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        }
        state.events.add(k);
        return data;
      }),
    },
    subscription: {
      findUnique: vi.fn(async ({ where }: { where: { providerSubscriptionId: string } }) =>
        state.subs.find((s) => s.providerSubscriptionId === where.providerSubscriptionId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `sub_${state.subs.length}`, ...data };
        state.subs.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.subs.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === state.org.id ? { ...state.org } : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.org, data)),
    },
    auditLog: { create: vi.fn(async () => void state.audits++) },
  };
  // Simulate transactional semantics loosely: errors propagate to caller.
  return { db: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } };
});

import { verifyRazorpaySignature } from "@/lib/billing/razorpay";
import { processRazorpayWebhook } from "@/lib/billing/webhook";

const SECRET = "whsec_test_123";
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

function event(type: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    entity: "event",
    event: type,
    payload: {
      subscription: {
        entity: { id: "sub_rzp_1", plan_id: "plan_x", status: "active", current_start: 1_790_000_000, current_end: 1_792_600_000, notes: { organizationId: "org_1", planId: "growth" }, ...extra },
      },
    },
  });
}

beforeEach(() => {
  state.events = new Set();
  state.subs = [];
  state.org = { id: "org_1", planId: "trial", status: "active" };
  state.audits = 0;
});

describe("verifyRazorpaySignature", () => {
  const body = '{"event":"subscription.charged"}';
  it("accepts a valid signature", () => {
    expect(verifyRazorpaySignature(body, sign(body), SECRET)).toBe(true);
  });
  it("rejects a wrong secret, tampered body, wrong length, or missing values", () => {
    expect(verifyRazorpaySignature(body, sign(body, "other"), SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body).slice(0, 10), SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, null, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body), undefined)).toBe(false);
  });
});

describe("processRazorpayWebhook", () => {
  it("rejects invalid signatures without touching the database", async () => {
    const body = event("subscription.activated");
    const res = await processRazorpayWebhook(body, { signature: "deadbeef", eventId: "evt_1" }, SECRET);
    expect(res.status).toBe("invalid_signature");
    expect(state.events.size).toBe(0);
    expect(state.org.planId).toBe("trial");
  });

  it("activates the plan from signed notes on subscription.activated", async () => {
    const body = event("subscription.activated");
    const res = await processRazorpayWebhook(body, { signature: sign(body), eventId: "evt_1" }, SECRET);
    expect(res).toMatchObject({ status: "processed", organizationId: "org_1" });
    expect(state.org).toMatchObject({ planId: "growth", status: "active" });
    expect(state.subs[0]).toMatchObject({ providerSubscriptionId: "sub_rzp_1", status: "active", planId: "growth" });
  });

  it("treats a replayed event id as a duplicate and does not re-apply it", async () => {
    const body = event("subscription.activated");
    await processRazorpayWebhook(body, { signature: sign(body), eventId: "evt_1" }, SECRET);
    state.org.status = "cancelled"; // if replay were re-applied this would flip back to active
    const res = await processRazorpayWebhook(body, { signature: sign(body), eventId: "evt_1" }, SECRET);
    expect(res.status).toBe("duplicate");
    expect(state.org.status).toBe("cancelled");
    expect(state.audits).toBe(1);
  });

  it("dedupes identical bodies when no event id header is sent", async () => {
    const body = event("subscription.charged");
    expect((await processRazorpayWebhook(body, { signature: sign(body), eventId: null }, SECRET)).status).toBe("processed");
    expect((await processRazorpayWebhook(body, { signature: sign(body), eventId: null }, SECRET)).status).toBe("duplicate");
  });

  it("maps halted -> past_due and cancelled -> cancelled without changing the plan", async () => {
    let body = event("subscription.activated");
    await processRazorpayWebhook(body, { signature: sign(body), eventId: "e1" }, SECRET);
    body = event("subscription.halted");
    await processRazorpayWebhook(body, { signature: sign(body), eventId: "e2" }, SECRET);
    expect(state.org).toMatchObject({ status: "past_due", planId: "growth" });
    expect(state.subs[0]!.status).toBe("past_due");
    body = event("subscription.cancelled");
    await processRazorpayWebhook(body, { signature: sign(body), eventId: "e3" }, SECRET);
    expect(state.org.status).toBe("cancelled");
    expect(state.subs[0]!.status).toBe("cancelled");
  });

  it("ignores unhandled event types (still recorded for idempotency)", async () => {
    const body = event("payment.captured");
    const res = await processRazorpayWebhook(body, { signature: sign(body), eventId: "e9" }, SECRET);
    expect(res.status).toBe("ignored");
    expect(state.events.has("razorpay:e9")).toBe(true);
  });
});
