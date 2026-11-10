// Customer billing details printed on GST invoices (BillingDetails, one per organization). Server-only.
import { z } from "zod";
import { db } from "@/lib/db";
import { isValidGstin } from "./gst";
import { isIndianStateCode, stateName } from "./indian-states";

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
