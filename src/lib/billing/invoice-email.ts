// "Payment received" email with a link to the GST invoice — sent once per invoice, right after the signed webhook
// created it (subscription charge or answer pack). Server-only.
//
// Goes to the invoice email saved under Billing details (when there is one) and to the workspace Owner. Sent once
// per invoice (SentMessage kind "invoice_email", key = invoice id), so a redelivered webhook never emails twice.
// Email not configured, or no one to send to → nothing is claimed and nothing fails; the invoice is always in
// Settings → Billing → Invoices.
import { isEmailConfigured } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { appLink, type EmailContent } from "@/lib/email/templates";
import { emailOnce, verifiedRecipients } from "@/lib/growth/deliver";
import { BRAND } from "@/lib/brand";
import { formatInr } from "./gst";
import type { InvoiceRecord } from "./invoice";

export const INVOICE_EMAIL_KIND = "invoice_email";

type InvoiceForEmail = Pick<InvoiceRecord, "id" | "number" | "description" | "basePaise" | "gstPaise" | "totalPaise" | "paidAt" | "organizationId" | "buyer">;

const IST_DAY: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" };

/** Pure: the email for one invoice. */
export function invoiceEmailTemplate(inv: Pick<InvoiceForEmail, "id" | "number" | "description" | "basePaise" | "gstPaise" | "totalPaise" | "paidAt">): EmailContent {
  const total = formatInr(inv.totalPaise);
  const amount = inv.gstPaise > 0 ? `${formatInr(inv.basePaise)} + ${formatInr(inv.gstPaise)} GST = ${total}` : total;
  const subject = `Payment received: ${total} (invoice ${inv.number})`;
  return {
    subject,
    ...renderEmail({
      title: `Payment received: ${total}`,
      preheader: `Your invoice ${inv.number} is ready.`,
      paragraphs: [
        "Hi,",
        `Thank you. We received your payment on ${inv.paidAt.toLocaleDateString("en-IN", IST_DAY)}.`,
        `What you paid for: ${inv.description}`,
        `Amount: ${amount}`,
        `Invoice number: ${inv.number}`,
        "Open the invoice to print it or save it as a PDF. You can find all your invoices under Settings, then Billing & usage.",
      ],
      cta: { label: "Open your invoice", url: appLink(`/app/settings/invoices/${inv.id}`) },
      footer: `Something not right on the invoice? Reply to this email or write to ${BRAND.supportEmail}.`,
    }),
  };
}

/** Recipients: the invoice email from Billing details first, then the Owner(s) with a confirmed email. */
export function invoiceRecipients(invoiceEmail: string | null | undefined, owners: string[]): string[] {
  const out: string[] = [];
  for (const e of [invoiceEmail ?? "", ...owners]) {
    const v = e.trim().toLowerCase();
    if (v && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Emails the invoice once. Returns true when an email went out. Never throws. */
export async function emailInvoice(inv: InvoiceForEmail | null | undefined): Promise<boolean> {
  try {
    if (!inv?.id || !inv.organizationId || !isEmailConfigured()) return false;
    const to = invoiceRecipients(inv.buyer?.email, await verifiedRecipients(inv.organizationId, ["owner"]));
    if (to.length === 0) return false;
    return await emailOnce({ kind: INVOICE_EMAIL_KIND, key: inv.id, organizationId: inv.organizationId, to, content: invoiceEmailTemplate(inv) });
  } catch (e) {
    console.warn("[billing] invoice email failed", (e as Error)?.name);
    return false;
  }
}
