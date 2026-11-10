// GST invoices (src/lib/billing/invoice.ts): sequential numbers per Indian financial year, idempotent on the
// Razorpay payment id (also under a race), snapshots of our and the customer's details, CGST+SGST vs IGST.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  invoices: [] as Row[],
  counters: new Map<string, number>(),
  details: new Map<string, Row>(),
  orgs: new Map<string, Row>([["org_1", { id: "org_1", name: "Sharma Dental" }]]),
  /** Simulate another delivery inserting the same payment between our check and our insert. */
  raceOnce: null as Row | null,
}));

vi.mock("@/lib/db", () => {
  const unique = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
  const invoice = {
    findUnique: async ({ where }: { where: { razorpayPaymentId: string } }) =>
      h.invoices.find((i) => i.razorpayPaymentId === where.razorpayPaymentId) ?? null,
    findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
      h.invoices.find((i) => i.id === where.id && i.organizationId === where.organizationId) ?? null,
    findMany: async ({ where }: { where: { organizationId: string } }) => h.invoices.filter((i) => i.organizationId === where.organizationId),
  };
  const db = {
    invoice,
    organization: { findUnique: async ({ where }: { where: { id: string } }) => h.orgs.get(where.id) ?? null },
    billingDetails: { findUnique: async ({ where }: { where: { organizationId: string } }) => h.details.get(where.organizationId) ?? null },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // Stage writes; commit only when fn resolves (rollback on throw).
      const counters = new Map(h.counters);
      const staged: Row[] = [];
      const tx = {
        invoiceCounter: {
          upsert: async ({ where }: { where: { financialYear: string } }) => {
            const n = (counters.get(where.financialYear) ?? 0) + 1;
            counters.set(where.financialYear, n);
            return { financialYear: where.financialYear, lastNumber: n };
          },
        },
        invoice: {
          create: async ({ data }: { data: Row }) => {
            if (h.raceOnce) {
              h.invoices.push(h.raceOnce);
              h.raceOnce = null;
            }
            if ([...h.invoices, ...staged].some((i) => i.razorpayPaymentId === data.razorpayPaymentId || i.number === data.number)) throw unique();
            const row = { id: `inv_${h.invoices.length + staged.length + 1}`, createdAt: new Date(), ...data };
            staged.push(row);
            return row;
          },
        },
      };
      const out = await fn(tx);
      h.counters = counters;
      h.invoices.push(...staged);
      return out;
    },
  };
  return { db };
});

import { createInvoiceForPayment, financialYearOf, formatInvoiceNumber, getInvoice, listInvoices } from "@/lib/billing/invoice";

const base = { organizationId: "org_1", kind: "subscription" as const, description: "MyWebRank Starter plan — monthly", basePaise: 199_900, gstPaise: 35_982, totalPaise: 235_882 };

beforeEach(() => {
  h.invoices = [];
  h.counters = new Map();
  h.details = new Map();
  h.raceOnce = null;
  vi.stubEnv("GSTIN", "07AAACM1234A1ZA");
  vi.stubEnv("GST_LEGAL_NAME", "Go Hype Media Private Limited");
  vi.stubEnv("GST_STATE_CODE", "");
  vi.stubEnv("GST_RATE_PERCENT", "");
  vi.stubEnv("GST_INVOICE_PREFIX", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("financial year + numbering", () => {
  it("uses the Indian financial year in IST", () => {
    expect(financialYearOf(new Date("2026-11-10T10:00:00Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2027-03-31T18:00:00Z"))).toBe("2026-27"); // 23:30 IST, 31 March
    expect(financialYearOf(new Date("2027-03-31T18:31:00Z"))).toBe("2027-28"); // 00:01 IST, 1 April
    expect(financialYearOf(new Date("2099-12-01T00:00:00Z"))).toBe("2099-00");
    expect(formatInvoiceNumber("MWR", "2026-27", 123)).toBe("MWR/2026-27/000123");
  });

  it("numbers invoices one after another and restarts each financial year", async () => {
    const a = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_a", paidAt: new Date("2026-11-10T10:00:00Z") });
    const b = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_b", paidAt: new Date("2026-12-10T10:00:00Z") });
    const c = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_c", paidAt: new Date("2027-04-02T10:00:00Z") });
    expect([a.number, b.number, c.number]).toEqual(["MWR/2026-27/000001", "MWR/2026-27/000002", "MWR/2027-28/000001"]);
  });

  it("uses GST_INVOICE_PREFIX", async () => {
    vi.stubEnv("GST_INVOICE_PREFIX", "INV");
    const a = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_p", paidAt: new Date("2026-11-10T10:00:00Z") });
    expect(a.number).toBe("INV/2026-27/000001");
  });
});

describe("idempotency", () => {
  it("returns the same invoice for a repeated payment id and uses no new number", async () => {
    const paidAt = new Date("2026-11-10T10:00:00Z");
    const a = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_dup", paidAt });
    const again = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_dup", paidAt });
    expect(again.id).toBe(a.id);
    expect(h.invoices).toHaveLength(1);
    const next = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_next", paidAt });
    expect(next.number).toBe("MWR/2026-27/000002");
  });

  it("returns the winner when a second delivery inserts the same payment concurrently (number rolled back)", async () => {
    const paidAt = new Date("2026-11-10T10:00:00Z");
    h.raceOnce = { id: "inv_winner", number: "MWR/2026-27/000099", razorpayPaymentId: "pay_race", organizationId: "org_1", seller: {}, buyer: {} };
    const r = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_race", paidAt });
    expect(r.id).toBe("inv_winner");
    expect(h.counters.get("2026-27") ?? 0).toBe(0);
  });
});

describe("snapshots and tax split", () => {
  it("defaults an org without billing details to our state (CGST+SGST) and its organization name", async () => {
    const r = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_1", paidAt: new Date("2026-11-10T10:00:00Z") });
    expect(r).toMatchObject({ split: "cgst_sgst", cgstPaise: 17_991, sgstPaise: 17_991, igstPaise: 0, ratePercent: 18, financialYear: "2026-27" });
    expect(r.buyer).toMatchObject({ legalName: "Sharma Dental", stateCode: "07", stateName: "Delhi", gstin: null, defaulted: true });
    expect(r.seller).toMatchObject({ legalName: "Go Hype Media Private Limited", gstin: "07AAACM1234A1ZA", stateCode: "07", sacCode: "998314" });
  });

  it("charges IGST to another state and keeps the customer's GSTIN", async () => {
    h.details.set("org_1", { organizationId: "org_1", legalName: "Sharma Dental LLP", gstin: "27AAPFU0939F1ZV", stateCode: "27", addressLine: "Pune", invoiceEmail: "accounts@sharma.in" });
    const r = await createInvoiceForPayment({ ...base, kind: "topup", razorpayPaymentId: "pay_2", paidAt: new Date("2026-11-10T10:00:00Z") });
    expect(r).toMatchObject({ kind: "topup", split: "igst", igstPaise: 35_982, cgstPaise: 0, sgstPaise: 0 });
    expect(r.buyer).toMatchObject({ legalName: "Sharma Dental LLP", gstin: "27AAPFU0939F1ZV", stateName: "Maharashtra", email: "accounts@sharma.in", defaulted: false });
  });

  it("issues a no-GST invoice when nothing was charged as GST", async () => {
    vi.stubEnv("GSTIN", "");
    const r = await createInvoiceForPayment({ ...base, gstPaise: 0, totalPaise: 199_900, razorpayPaymentId: "pay_3", paidAt: new Date("2026-11-10T10:00:00Z") });
    expect(r).toMatchObject({ split: "none", ratePercent: 0, gstPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 });
    expect(r.seller.gstin).toBeNull();
  });

  it("only returns an organization's own invoices", async () => {
    const r = await createInvoiceForPayment({ ...base, razorpayPaymentId: "pay_4", paidAt: new Date("2026-11-10T10:00:00Z") });
    expect(await getInvoice("org_1", r.id)).not.toBeNull();
    expect(await getInvoice("org_2", r.id)).toBeNull();
    expect(await listInvoices("org_2")).toEqual([]);
  });
});
