// Customer billing details printed on GST invoices (BillingDetails, one per organization). Server-only.
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { isValidGstin } from "./gst";
import { isIndianStateCode, stateName } from "./indian-states";
import { BILLING_DETAILS_HREF } from "./links";

export const billingDetailsSchema = z
  .object({
    legalName: z.string().trim().min(2, "Enter your business or legal name.").max(200),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .max(15)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isValidGstin(v), "That GSTIN doesn't look right. It has 15 characters, like 27AAPFU0939F1ZV."),
    stateCode: z.string().trim().refine(isIndianStateCode, "Choose your state."),
    addressLine: z
      .string()
      .trim()
      .max(300)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    invoiceEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v ? v.toLowerCase() : null))
      .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email address."),
  })
  .refine((d) => !d.gstin || d.gstin.slice(0, 2) === d.stateCode, {
    message: "Your GSTIN starts with a different state code than the state you chose.",
    path: ["gstin"],
  });

export type BillingDetailsInput = z.infer<typeof billingDetailsSchema>;

export interface BillingDetailsView {
  legalName: string;
  gstin: string | null;
  stateCode: string;
  stateName: string;
  addressLine: string | null;
  invoiceEmail: string | null;
  updatedAt: string;
}

export async function getBillingDetails(organizationId: string): Promise<BillingDetailsView | null> {
  const r = await db.billingDetails.findUnique({ where: { organizationId } });
  if (!r) return null;
  return {
    legalName: r.legalName,
    gstin: r.gstin,
    stateCode: r.stateCode,
    stateName: stateName(r.stateCode),
    addressLine: r.addressLine,
    invoiceEmail: r.invoiceEmail,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function saveBillingDetails(organizationId: string, input: BillingDetailsInput): Promise<BillingDetailsView> {
  await db.billingDetails.upsert({
    where: { organizationId },
    create: { organizationId, ...input },
    update: { ...input },
  });
  return (await getBillingDetails(organizationId))!;
}

/** Error code the checkout routes return when the business name / state are missing (the client shows the form). */
export const BILLING_DETAILS_REQUIRED = "billing_details_required";

/** True when the invoice can be issued correctly: a business name and a state (decides CGST + SGST or IGST). */
export function hasInvoiceBasics(d: { legalName?: string | null; stateCode?: string | null } | null | undefined): boolean {
  return !!d && (d.legalName ?? "").trim().length >= 2 && isIndianStateCode((d.stateCode ?? "").trim());
}

/**
 * Checkout guard (subscription and answer packs): no payment is started until the business name and state are
 * saved. Without them the invoice was issued in the workspace name with OUR state as place of supply — CGST + SGST
 * on a customer from another state, where IGST is due (app audit 15 Nov 2026, Fix 29).
 */
export async function requireBillingDetailsForPayment(organizationId: string): Promise<BillingDetailsView> {
  const d = await getBillingDetails(organizationId);
  if (!d || !hasInvoiceBasics(d)) {
    throw new HttpError(
      409,
      BILLING_DETAILS_REQUIRED,
      "Before you pay, add your business name and state, so your GST invoice is correct. Save them under Billing details, then try again.",
      { next: BILLING_DETAILS_HREF },
    );
  }
  return d;
}

export interface CheckoutPrefill {
  email?: string;
  name?: string;
  /** Phone / WhatsApp number in international format, when the workspace saved one. */
  contact?: string;
}

/** What we already know about the payer, to pre-fill Razorpay Checkout (never required; empty values are left out). */
export async function checkoutPrefill(organizationId: string, userId: string): Promise<CheckoutPrefill> {
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }).catch(() => null),
    db.organization.findUnique({ where: { id: organizationId }, select: { name: true, whatsappNumber: true } }).catch(() => null),
  ]);
  const out: CheckoutPrefill = {};
  if (user?.email) out.email = user.email;
  const name = (user?.name ?? "").trim() || (org?.name ?? "").trim();
  if (name) out.name = name;
  const contact = (org?.whatsappNumber ?? "").trim();
  if (/^\+?\d{8,15}$/.test(contact)) out.contact = contact;
  return out;
}
