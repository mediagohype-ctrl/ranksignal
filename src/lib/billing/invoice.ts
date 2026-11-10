// GST invoices: one per captured Razorpay payment (subscription charge or top-up). Server-only.
//
// createInvoiceForPayment is called from the signed Razorpay webhook. It is idempotent on razorpayPaymentId (unique):
// a repeat call returns the existing invoice. Invoice numbers are sequential per Indian financial year
// (PREFIX/2026-27/000123) from an InvoiceCounter row incremented in the SAME transaction as the insert, so a failed
// insert never burns a number. The invoice keeps a snapshot of our GST details and the customer's billing details
// at that moment — later edits never change an issued invoice.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { LEGAL_ADDRESS, LEGAL_ENTITY } from "@/lib/site";
import { gstConfig, splitGst, type GstConfig, type GstSplit } from "./gst";
import { stateName } from "./indian-states";

export type InvoiceKind = "subscription" | "topup";

export interface CreateInvoiceInput {
  organizationId: string;
  kind: InvoiceKind;
  razorpayPaymentId: string;
  description: string;
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  paidAt: Date;
}

export interface InvoiceSeller {
  legalName: string;
  gstin: string | null;
  address: string;
  stateCode: string;
  stateName: string;
  sacCode: string;
  email: string;
}

export interface InvoiceBuyer {
  legalName: string;
  gstin: string | null;
  stateCode: string;
  stateName: string;
  addressLine: string | null;
  email: string | null;
  /** True when the customer had not entered billing details: place of supply defaulted to our state. */
  defaulted: boolean;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  financialYear: string;
  /** Null once the customer deleted their account (the invoice is kept for tax records). */
  organizationId: string | null;
  kind: string;
  razorpayPaymentId: string;
  description: string;
  basePaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  ratePercent: number;
  split: string;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  paidAt: Date;
  createdAt: Date;
}

const IST_OFFSET_MS = 330 * 60_000;

/** Indian financial year (April–March, IST) of a date: "2026-27". */
export function financialYearOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** "MWR/2026-27/000123". */
export function formatInvoiceNumber(prefix: string, financialYear: string, n: number): string {
  return `${prefix}/${financialYear}/${String(n).padStart(6, "0")}`;
}

export function sellerSnapshot(cfg: GstConfig = gstConfig()): InvoiceSeller {
  return {
    legalName: cfg.legalName ?? LEGAL_ENTITY,
    gstin: cfg.gstin,
    address: LEGAL_ADDRESS,
    stateCode: cfg.stateCode,
    stateName: stateName(cfg.stateCode),
    sacCode: cfg.sacCode,
    email: BRAND.supportEmail,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function toRecord(r: {
  id: string; number: string; financialYear: string; organizationId: string | null; kind: string; razorpayPaymentId: string;
  description: string; basePaise: number; gstPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
  totalPaise: number; ratePercent: number; split: string; seller: unknown; buyer: unknown; paidAt: Date; createdAt: Date;
}): InvoiceRecord {
  return { ...r, seller: r.seller as InvoiceSeller, buyer: r.buyer as InvoiceBuyer };
}

/** Creates (or returns the existing) invoice for a captured payment. See the file header. */
export async function createInvoiceForPayment(input: CreateInvoiceInput): Promise<InvoiceRecord> {
  const existing = await db.invoice.findUnique({ where: { razorpayPaymentId: input.razorpayPaymentId } });
  if (existing) return toRecord(existing);

  const cfg = gstConfig();
  const [org, details] = await Promise.all([
    db.organization.findUnique({ where: { id: input.organizationId }, select: { name: true } }),
    db.billingDetails.findUnique({ where: { organizationId: input.organizationId } }),
  ]);
  const buyerState = details?.stateCode ?? cfg.stateCode;
  const buyer: InvoiceBuyer = {
    legalName: details?.legalName ?? org?.name ?? "Customer",
    gstin: details?.gstin ?? null,
    stateCode: buyerState,
    stateName: stateName(buyerState),
    addressLine: details?.addressLine ?? null,
    email: details?.invoiceEmail ?? null,
    defaulted: !details,
  };
  const gstPaise = Math.max(0, Math.round(input.gstPaise));
  const split: GstSplit = gstPaise <= 0 ? "none" : buyerState !== cfg.stateCode ? "igst" : "cgst_sgst";
  const parts = splitGst(gstPaise, split);
  const basePaise = Math.round(input.basePaise);
  const ratePercent = gstPaise > 0 && basePaise > 0 ? (cfg.ratePercent || Math.round((gstPaise / basePaise) * 10_000) / 100) : 0;
  const fy = financialYearOf(input.paidAt);
  const seller = sellerSnapshot(cfg);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await db.$transaction(async (tx) => {
        const counter = await tx.invoiceCounter.upsert({
          where: { financialYear: fy },
          create: { financialYear: fy, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        return tx.invoice.create({
          data: {
            number: formatInvoiceNumber(cfg.prefix, fy, counter.lastNumber),
            financialYear: fy,
            organizationId: input.organizationId,
            kind: input.kind,
            razorpayPaymentId: input.razorpayPaymentId,
            description: input.description.slice(0, 300),
            basePaise,
            gstPaise,
            ...parts,
            totalPaise: Math.round(input.totalPaise),
            ratePercent,
            split,
            seller: seller as unknown as Prisma.InputJsonValue,
            buyer: buyer as unknown as Prisma.InputJsonValue,
            paidAt: input.paidAt,
          },
        });
      });
      return toRecord(row);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Same payment raced in from a second delivery: return the invoice that won. Otherwise (first counter row for a
      // new financial year created concurrently) retry; the rolled-back transaction used no number.
      const won = await db.invoice.findUnique({ where: { razorpayPaymentId: input.razorpayPaymentId } });
      if (won) return toRecord(won);
    }
  }
  throw new Error("Could not allocate an invoice number");
}

/** Invoices of one organization, newest first. */
export async function listInvoices(organizationId: string, take = 100): Promise<InvoiceRecord[]> {
  const rows = await db.invoice.findMany({ where: { organizationId }, orderBy: { paidAt: "desc" }, take });
  return rows.map(toRecord);
}

/** One invoice, scoped to the organization (null when it belongs to someone else). */
export async function getInvoice(organizationId: string, id: string): Promise<InvoiceRecord | null> {
  const r = await db.invoice.findFirst({ where: { id, organizationId } });
  return r ? toRecord(r) : null;
}
