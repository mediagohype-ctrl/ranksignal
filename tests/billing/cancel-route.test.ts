// POST /api/billing/cancel (app audit Fix 34: "Cancel subscription" could not be tested live). Razorpay is mocked —
// no real API call. The plan keeps working to the end of the paid period; the signed webhook
// (subscription.cancelled, tests/billing/webhook.test.ts) applies the change.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sub = { id: string; provider: string; providerSubscriptionId: string | null; planId: string; status: string; currentPeriodEnd: Date | null };
const h = vi.hoisted(() => ({
  role: "owner",
  membershipRole: "owner",
  configured: true,
  sub: null as Sub | null,
  cancelRequestedAt: null as Date | null,
  rzpCancels: [] as { id: string; atCycleEnd: boolean }[],
  rzpFails: false,
  audits: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  const RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
  return {
    ...actual,
    requireSession: vi.fn(async (min = "viewer") => {
      if (RANK[h.role] < RANK[min]) throw new actual.HttpError(403, "forbidden", "Insufficient role");
      return { userId: "u1", email: "a@b.c", organizationId: "org_1", role: h.role };
    }),
  };
});
vi.mock("@/lib/auth/membership", async () => {
  const { HttpError } = await import("@/lib/api");
  return {
    requireActiveMembership: vi.fn(async (_s: unknown, allowed: string[]) => {
      if (!allowed.includes(h.membershipRole)) throw new HttpError(403, "forbidden", "Insufficient role");
    }),
  };
});
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async (e: Record<string, unknown>) => void h.audits.push(e)) }));
vi.mock("@/lib/billing/razorpay", () => ({
  isRazorpayConfigured: () => h.configured,
  cancelRazorpaySubscription: vi.fn(async (id: string, atCycleEnd: boolean) => {
    if (h.rzpFails) throw new Error("Razorpay returned 500");
    h.rzpCancels.push({ id, atCycleEnd });
    return { id, status: "active" };
  }),
}));
vi.mock("@/lib/billing/subscription", () => ({
  getCurrentProviderSubscription: vi.fn(async () => h.sub),
  getCancelRequestedAt: vi.fn(async () => h.cancelRequestedAt),
}));

import { POST as cancel } from "@/app/api/billing/cancel/route";

const PERIOD_END = new Date("2026-12-10T00:00:00Z");
const call = () => (cancel as unknown as (req: Request) => Promise<Response>)(new Request("https://app.test/api/billing/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));

beforeEach(() => {
  h.role = "owner";
  h.membershipRole = "owner";
  h.configured = true;
  h.sub = { id: "s1", provider: "razorpay", providerSubscriptionId: "sub_123", planId: "starter", status: "active", currentPeriodEnd: PERIOD_END };
  h.cancelRequestedAt = null;
  h.rzpCancels = [];
  h.rzpFails = false;
  h.audits = [];
});

describe("POST /api/billing/cancel", () => {
  it("owner: cancels at the END of the billing cycle (never immediately) and records who asked", async () => {
    const r = await call();
    expect(r.status).toBe(200);
    expect((await r.json()).item).toMatchObject({ subscriptionId: "sub_123", cancelAtPeriodEnd: true, currentPeriodEnd: PERIOD_END.toISOString() });
    expect(h.rzpCancels).toEqual([{ id: "sub_123", atCycleEnd: true }]);
    expect(h.audits[0]).toMatchObject({ organizationId: "org_1", actorId: "u1", action: "billing.cancel_requested", resourceId: "sub_123" });
  });

  it("asking twice doesn't call Razorpay again", async () => {
    h.cancelRequestedAt = new Date("2026-11-15T00:00:00Z");
    const r = await call();
    expect(r.status).toBe(200);
    expect((await r.json()).item.cancelAtPeriodEnd).toBe(true);
    expect(h.rzpCancels).toHaveLength(0);
    expect(h.audits).toHaveLength(0);
  });

  it("past_due subscriptions can be cancelled too", async () => {
    h.sub!.status = "past_due";
    expect((await call()).status).toBe(200);
    expect(h.rzpCancels).toHaveLength(1);
  });

  it("no paid subscription (trial, already cancelled, not Razorpay) → 404 with a plain message", async () => {
    for (const sub of [null, { ...h.sub!, status: "cancelled" }, { ...h.sub!, provider: "manual" }, { ...h.sub!, providerSubscriptionId: null }]) {
      h.sub = sub as Sub | null;
      const r = await call();
      expect(r.status).toBe(404);
      expect((await r.json()).error.message).toBe("There is no active paid subscription to cancel.");
    }
    expect(h.rzpCancels).toHaveLength(0);
  });

  it("Razorpay down → 502, nothing recorded", async () => {
    h.rzpFails = true;
    const r = await call();
    expect(r.status).toBe(502);
    expect(h.audits).toHaveLength(0);
  });

  it("online billing not set up → 501", async () => {
    h.configured = false;
    expect((await call()).status).toBe(501);
  });

  it("only the Owner or an Admin can cancel", async () => {
    h.role = "member";
    expect((await call()).status).toBe(403);
    h.role = "admin";
    h.membershipRole = "member"; // demoted since signing in
    expect((await call()).status).toBe(403);
    expect(h.rzpCancels).toHaveLength(0);
  });
});
