// Route guards for billing details + invoices (owner/admin only, scoped to the session's organization), GSTIN
// validation, checkout returning the price + GST breakdown, and the admin Razorpay plan-amount check.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string },
  memberships: new Map<string, string>(), // `${userId}:${orgId}` → role
  details: new Map<string, Row>(),
  invoices: [] as Row[],
  audits: [] as Row[],
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: async (e: Row) => void h.audits.push(e) }));
vi.mock("@/lib/billing/razorpay", () => ({
  isRazorpayConfigured: () => true,
  createRazorpaySubscription: async () => ({ id: "sub_new", plan_id: "plan_s", status: "created", short_url: "https://rzp.io/x" }),
}));
vi.mock("@/lib/billing/subscription", () => ({ getCurrentProviderSubscription: async () => null }));
vi.mock("@/lib/db", () => ({
  db: {
    membership: {
      findUnique: async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) => {
        const role = h.memberships.get(`${where.userId_organizationId.userId}:${where.userId_organizationId.organizationId}`);
        return role ? { role, status: "active" } : null;
      },
    },
    billingDetails: {
      findUnique: async ({ where }: { where: { organizationId: string } }) => h.details.get(where.organizationId) ?? null,
      upsert: async ({ where, create, update }: { where: { organizationId: string }; create: Row; update: Row }) => {
        const prev = h.details.get(where.organizationId);
        const row = { ...(prev ?? create), ...(prev ? update : {}), updatedAt: new Date() };
        h.details.set(where.organizationId, row);
        return row;
      },
    },
    invoice: {
      findMany: async ({ where }: { where: { organizationId: string } }) => h.invoices.filter((i) => i.organizationId === where.organizationId),
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        h.invoices.find((i) => i.id === where.id && i.organizationId === where.organizationId) ?? null,
    },
  },
}));

import { GET as getDetails, PUT as putDetails } from "@/app/api/billing/details/route";
import { GET as listRoute } from "@/app/api/billing/invoices/route";
import { GET as oneRoute } from "@/app/api/billing/invoices/[id]/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { razorpayPlanChecks } from "@/lib/admin/system";

const put = (body: unknown) => new Request("https://app.test/api/billing/details", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const as = (role: string, org = "o1") => {
  h.session = { userId: "u1", email: "a@acme.in", organizationId: org, role };
  h.memberships.set(`u1:${org}`, role);
};
const invoiceRow = (id: string, organizationId: string): Row => ({
  id, organizationId, number: `MWR/2026-27/00000${id.slice(-1)}`, financialYear: "2026-27", kind: "subscription", razorpayPaymentId: `pay_${id}`,
  description: "Starter plan", basePaise: 199_900, gstPaise: 35_982, cgstPaise: 17_991, sgstPaise: 17_991, igstPaise: 0, totalPaise: 235_882,
  ratePercent: 18, split: "cgst_sgst", seller: {}, buyer: {}, paidAt: new Date("2026-11-10T10:00:00Z"), createdAt: new Date(),
});

beforeEach(() => {
  h.memberships.clear();
  h.details.clear();
  h.audits = [];
  h.invoices = [invoiceRow("inv_1", "o1"), invoiceRow("inv_2", "o2")];
  vi.stubEnv("GSTIN", "07AAACM1234A1ZA");
  vi.stubEnv("GST_RATE_PERCENT", "");
  vi.stubEnv("GST_STATE_CODE", "");
  vi.stubEnv("RAZORPAY_PLAN_STARTER", "plan_s");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("billing details", () => {
  it("requires sign-in and owner/admin", async () => {
    h.session = null;
    expect((await getDetails()).status).toBe(401);
    as("member");
    expect((await getDetails()).status).toBe(403);
    expect((await putDetails(put({ legalName: "X", stateCode: "07" }))).status).toBe(403);
    as("viewer");
    expect((await putDetails(put({ legalName: "X", stateCode: "07" }))).status).toBe(403);
  });

  it("lets an owner save details for their own organization only", async () => {
    as("owner");
    const r = await putDetails(put({ legalName: "Sharma Dental LLP", gstin: "27aapfu0939f1zv", stateCode: "27", addressLine: "Pune", invoiceEmail: "Accounts@Sharma.in" }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.item).toMatchObject({ legalName: "Sharma Dental LLP", gstin: "27AAPFU0939F1ZV", stateCode: "27", stateName: "Maharashtra", invoiceEmail: "accounts@sharma.in" });
    expect([...h.details.keys()]).toEqual(["o1"]);
    expect(h.audits[0]).toMatchObject({ action: "billing.details_updated", organizationId: "o1" });
    expect((await (await getDetails()).json()).item.legalName).toBe("Sharma Dental LLP");
  });

  it("rejects a bad GSTIN, a GSTIN from another state and an unknown state", async () => {
    as("admin");
    expect((await putDetails(put({ legalName: "Sharma", gstin: "27AAPFU0939F1ZX", stateCode: "27" }))).status).toBe(400);
    expect((await putDetails(put({ legalName: "Sharma", gstin: "27AAPFU0939F1ZV", stateCode: "07" }))).status).toBe(400);
    expect((await putDetails(put({ legalName: "Sharma", stateCode: "99" }))).status).toBe(400);
    expect((await putDetails(put({ legalName: "Sharma", stateCode: "07", gstin: "" }))).status).toBe(200);
    expect(h.details.get("o1")?.gstin).toBeNull();
  });
});

describe("invoices", () => {
  it("are owner/admin only", async () => {
    as("member");
    expect((await listRoute()).status).toBe(403);
    expect((await oneRoute(new Request("https://app.test"), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(403);
  });

  it("lists and opens only the organization's own invoices", async () => {
    as("admin");
    const j = await (await listRoute()).json();
    expect(j.items.map((i: Row) => i.id)).toEqual(["inv_1"]);
    expect((await oneRoute(new Request("https://app.test"), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(200);
    expect((await oneRoute(new Request("https://app.test"), { params: Promise.resolve({ id: "inv_2" }) })).status).toBe(404);
  });
});

describe("checkout", () => {
  it("returns price, GST and total for the customer's state", async () => {
    as("owner");
    h.details.set("o1", { organizationId: "o1", legalName: "Sharma", gstin: null, stateCode: "27", addressLine: null, invoiceEmail: null, updatedAt: new Date() });
    const r = await checkout(new Request("https://app.test/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: "starter" }) }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.item.price).toMatchObject({ basePaise: 199_900, gstPaise: 35_982, totalPaise: 235_882, split: "igst" });
  });

  it("is refused for members", async () => {
    as("member");
    const r = await checkout(new Request("https://app.test/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: "starter" }) }));
    expect(r.status).toBe(403);
  });
});

describe("admin: Razorpay plan amount check", () => {
  const env = { RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s", GSTIN: "07AAACM1234A1ZA", RAZORPAY_PLAN_STARTER: "plan_s", RAZORPAY_PLAN_GROWTH: "plan_g" };

  it("passes when the plan charges price + GST, warns with the right amount otherwise", async () => {
    const plans: Record<string, { amount: number }> = { plan_s: { amount: 235_882 }, plan_g: { amount: 799_900 } };
    const checks = await razorpayPlanChecks(env, async (id) => ({ id, period: "monthly", interval: 1, item: { amount: plans[id].amount, currency: "INR" } }));
    expect(checks).toHaveLength(2);
    expect(checks[0]).toMatchObject({ key: "RAZORPAY_PLAN_STARTER amount", status: "ok" });
    expect(checks[1].status).toBe("warn");
    expect(checks[1].detail).toContain("charges ₹7,999");
    expect(checks[1].detail).toContain("It should be ₹9,438.82 a month (₹7,999 + ₹1,439.82 GST)");
  });

  it("expects the plain price when we are not GST-registered, and survives Razorpay errors", async () => {
    const checks = await razorpayPlanChecks({ ...env, GSTIN: "", RAZORPAY_PLAN_GROWTH: "" }, async (id) => ({ id, period: "monthly", interval: 1, item: { amount: 199_900 } }));
    expect(checks).toEqual([expect.objectContaining({ status: "ok" })]);
    const failed = await razorpayPlanChecks(env, async () => {
      throw new Error("boom");
    });
    expect(failed.every((c) => c.status === "warn" && c.detail.startsWith("Couldn't read plan"))).toBe(true);
    expect(await razorpayPlanChecks({ RAZORPAY_PLAN_STARTER: "plan_s" })).toEqual([]);
  });
});
