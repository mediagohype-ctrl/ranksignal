import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner" as string,
  membershipRole: "owner" as string,
  access: { active: true, planId: "starter" } as { active: boolean; planId: string; reason?: string },
  orders: [] as Record<string, unknown>[],
  rzpCalls: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  const RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
  return {
    ...actual,
    requireSession: vi.fn(async (min = "viewer") => {
      if (RANK[state.role] < RANK[min]) throw new actual.HttpError(403, "forbidden", "Insufficient role");
      return { userId: "u1", email: "a@b.c", organizationId: "org_1", role: state.role };
    }),
  };
});
vi.mock("@/lib/auth/membership", async () => {
  const { HttpError } = await import("@/lib/api");
  return {
    requireActiveMembership: vi.fn(async (_s: unknown, allowed: string[]) => {
      if (!allowed.includes(state.membershipRole)) throw new HttpError(403, "forbidden", "Insufficient role");
    }),
  };
});
vi.mock("@/lib/billing/access", () => ({
  getOrgAccess: vi.fn(async () => state.access),
  accessMessage: vi.fn(() => "Your free trial has ended."),
}));
vi.mock("@/lib/billing/razorpay-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/razorpay-orders")>()),
  createRazorpayOrder: vi.fn(async (o: { amountPaise: number; receipt: string; notes: Record<string, string> }) => {
    state.rzpCalls.push(o);
    return { id: "order_new", amount: o.amountPaise, currency: "INR" };
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    billingDetails: { findUnique: vi.fn(async () => null) },
    topUpOrder: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `o${state.orders.length + 1}`, ...data, status: "pending" };
        state.orders.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { razorpayOrderId: string; organizationId: string } }) =>
        state.orders.find((o) => o.razorpayOrderId === where.razorpayOrderId && o.organizationId === where.organizationId) ?? null,
      ),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  },
}));

import { POST as buy } from "@/app/api/billing/topups/route";
import { POST as verify } from "@/app/api/billing/topups/verify/route";

const req = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  state.role = "owner";
  state.membershipRole = "owner";
  state.access = { active: true, planId: "starter" };
  state.orders = [];
  state.rzpCalls = [];
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "key_secret");
  vi.stubEnv("GSTIN", "07AAACB1234C1Z5");
  vi.stubEnv("GST_RATE_PERCENT", "18");
});

describe("POST /api/billing/topups", () => {
  it("owner: creates a Razorpay order for price + GST and a pending order row", async () => {
    const res = await buy(req({ packId: "answers_35" }));
    expect(res.status).toBe(200);
    const { item } = await res.json();
    expect(item).toMatchObject({ orderId: "order_new", keyId: "rzp_test_key", amount: 29_500, breakdown: { basePaise: 25_000, gstPaise: 4_500, totalPaise: 29_500 } });
    expect(state.rzpCalls[0]).toMatchObject({ amountPaise: 29_500, notes: { organizationId: "org_1", packId: "answers_35" } });
    expect(state.orders[0]).toMatchObject({ organizationId: "org_1", razorpayOrderId: "order_new", totalPaise: 29_500, status: "pending" });
  });
  it("members and viewers can't buy", async () => {
    state.role = "member";
    expect((await buy(req({ packId: "answers_100" }))).status).toBe(403);
    expect(state.rzpCalls).toHaveLength(0);
  });
  it("an admin whose membership is no longer owner/admin can't buy", async () => {
    state.role = "admin";
    state.membershipRole = "member";
    expect((await buy(req({ packId: "answers_100" }))).status).toBe(403);
  });
  it("needs active access (an ended trial can't buy)", async () => {
    state.access = { active: false, planId: "trial", reason: "trial_expired" };
    const res = await buy(req({ packId: "answers_100" }));
    expect(res.status).toBe(402);
    expect(state.rzpCalls).toHaveLength(0);
  });
  it("rejects unknown packs", async () => {
    expect((await buy(req({ packId: "answers_1" }))).status).toBe(400);
  });
});

describe("POST /api/billing/topups/verify", () => {
  it("valid signature → payment_received (adds nothing); wrong signature → 400; other org's order → 404", async () => {
    state.orders = [{ id: "o1", organizationId: "org_1", razorpayOrderId: "order_1", status: "pending" }];
    const sig = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    let res = await verify(req({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: sig }));
    expect((await res.json()).item.status).toBe("payment_received");
    expect(state.orders[0].status).toBe("pending");
    res = await verify(req({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_2", razorpay_signature: sig }));
    expect(res.status).toBe(400);
    state.orders[0].organizationId = "org_2";
    res = await verify(req({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: sig }));
    expect(res.status).toBe(404);
  });
});
