import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  subs: [] as Record<string, unknown>[],
  org: { id: "org_1", planId: "trial", status: "active" } as Record<string, unknown>,
  audits: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const subscription = {
    findUnique: vi.fn(async ({ where }: { where: { providerSubscriptionId: string } }) =>
      state.subs.find((s) => s.providerSubscriptionId === where.providerSubscriptionId) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `row_${state.subs.length}`, ...data };
      state.subs.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
      Object.assign(state.subs.find((s) => s.id === where.id)!, data),
    ),
    updateMany: vi.fn(async () => ({ count: 0 })),
    findFirst: vi.fn(async () => null),
  };
  const organization = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === state.org.id ? { ...state.org } : null)),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.org, data)),
  };
  const auditLog = { create: vi.fn(async ({ data }: { data: { action: string } }) => void state.audits.push(data.action)) };
  const tx = { subscription, organization, auditLog };
  return { db: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } };
});
vi.mock("@/lib/alerts/staff", () => ({ sendStaffAlert: vi.fn() }));
vi.mock("@/lib/growth/referral", () => ({ applyReferralReward: vi.fn(async () => undefined) }));

import { syncOrganizationFromRazorpay } from "@/lib/billing/sync";

const sub = (o: Record<string, unknown>) => ({
  id: "sub_ABC123456",
  plan_id: "plan_agency_live",
  status: "active",
  created_at: 1_790_000_000,
  current_start: 1_790_000_000,
  current_end: 1_792_600_000,
  notes: { organizationId: "org_1", planId: "agency" },
  ...o,
});

function mockRazorpay(items: Record<string, unknown>[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const one = /\/subscriptions\/([^?]+)$/.exec(url);
    if (one) {
      const found = items.find((i) => i.id === decodeURIComponent(one[1]!));
      return new Response(found ? JSON.stringify(found) : "{}", { status: found ? 200 : 404 });
    }
    return new Response(JSON.stringify({ items }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  state.subs = [];
  state.org = { id: "org_1", planId: "trial", status: "active" };
  state.audits = [];
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_x");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
  vi.stubEnv("RAZORPAY_PLAN_AGENCY", "plan_agency_live");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("checking Razorpay directly when a webhook was missed", () => {
  it("switches on the plan the customer paid for", async () => {
    mockRazorpay([sub({})]);
    const r = await syncOrganizationFromRazorpay("org_1");
    expect(r).toEqual({ status: "activated", planId: "agency", subscriptionId: "sub_ABC123456" });
    expect(state.org).toMatchObject({ planId: "agency", status: "active" });
    expect(state.subs[0]).toMatchObject({ providerSubscriptionId: "sub_ABC123456", status: "active", planId: "agency" });
    expect(state.audits).toEqual(["billing.synced_from_razorpay"]);
  });

  it("does nothing twice once the plan is already on", async () => {
    mockRazorpay([sub({})]);
    await syncOrganizationFromRazorpay("org_1");
    expect(await syncOrganizationFromRazorpay("org_1")).toEqual({ status: "already_up_to_date", planId: "agency" });
    expect(state.audits).toHaveLength(1);
  });

  it("ignores other organizations' subscriptions, even when their id is passed in", async () => {
    mockRazorpay([sub({ notes: { organizationId: "org_2", planId: "agency" } })]);
    expect(await syncOrganizationFromRazorpay("org_1")).toEqual({ status: "nothing_paid" });
    expect(await syncOrganizationFromRazorpay("org_1", "sub_ABC123456")).toEqual({ status: "nothing_paid" });
    expect(state.org.planId).toBe("trial");
  });

  it("never switches a plan on for an unpaid or failed subscription", async () => {
    mockRazorpay([sub({ status: "created" }), sub({ id: "sub_HALTED0001", status: "halted" })]);
    expect(await syncOrganizationFromRazorpay("org_1")).toEqual({ status: "nothing_paid" });
    expect(state.org.planId).toBe("trial");
  });

  it("is a no-op when Razorpay isn't set up", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    expect(await syncOrganizationFromRazorpay("org_1")).toEqual({ status: "not_configured" });
  });
});
