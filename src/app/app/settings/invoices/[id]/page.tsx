// Printable GST tax invoice for one payment (owner/admin). "Print or save as PDF" uses the browser's print dialog.
// Everything shown comes from the snapshot stored on the invoice when it was issued — later edits to billing
// details or env never change an issued invoice. No phone number, by owner decision.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAppSession, hasRole } from "@/lib/dashboard/server";
import { getInvoice } from "@/lib/billing/invoice";
import { formatInr } from "@/lib/billing/gst";
import { amountInWords } from "@/lib/billing/amount-words";
import { PrintButton } from "@/components/app/print-button";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" };

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : undefined}>
      <td className="border border-border px-3 py-2">{label}</td>
      <td className="border border-border px-3 py-2 text-right tabular-nums">{value}</td>
    </tr>
  );
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAppSession();
  if (!hasRole(s, "admin")) notFound();
  const { id } = await params;
  const inv = await getInvoice(s.organizationId, id);
  if (!inv) notFound();
  const { seller, buyer } = inv;
  const taxInvoice = !!seller.gstin && inv.gstPaise > 0;
  const date = inv.paidAt.toLocaleDateString("en-IN", IST);
  const half = inv.ratePercent / 2;

  return (
    <div className="mx-auto max-w-3xl text-fg print:max-w-none">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/settings?tab=billing" className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden /> Back to billing
        </Link>
        <PrintButton label="Print or save as PDF" variant="primary" />
      </div>

      <article className="rounded-xl border border-border bg-surface p-6 text-small sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-fg pb-5">
          <div>
            <h1 className="text-h2 text-fg">{taxInvoice ? "Tax invoice" : "Invoice"}</h1>
            <p className="mt-1 text-fg-soft">Original for recipient</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right">
            <dt className="text-muted">Invoice number</dt>
            <dd className="font-mono font-medium">{inv.number}</dd>
            <dt className="text-muted">Invoice date</dt>
            <dd>{date}</dd>
            <dt className="text-muted">Payment reference</dt>
            <dd className="font-mono text-xs">{inv.razorpayPaymentId}</dd>
          </dl>
        </header>

        <section className="grid gap-6 border-b border-border py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-caption uppercase tracking-[0.06em] text-muted">From</h2>
            <p className="mt-2 font-semibold">{seller.legalName}</p>
            {seller.address && <p className="text-fg-soft">{seller.address}</p>}
            {seller.gstin && <p className="mt-1">GSTIN: <span className="font-mono">{seller.gstin}</span></p>}
            <p>
              State: {seller.stateName || "—"} (code {seller.stateCode})
            </p>
            <p className="text-fg-soft">{seller.email}</p>
          </div>
          <div>
            <h2 className="text-caption uppercase tracking-[0.06em] text-muted">Billed to</h2>
            <p className="mt-2 font-semibold">{buyer.legalName}</p>
            {buyer.addressLine && <p className="text-fg-soft">{buyer.addressLine}</p>}
            {buyer.gstin && <p className="mt-1">GSTIN: <span className="font-mono">{buyer.gstin}</span></p>}
            <p>
              Place of supply: {buyer.stateName || "—"} (code {buyer.stateCode})
            </p>
            {buyer.email && <p className="text-fg-soft">{buyer.email}</p>}
          </div>
        </section>

        <section className="py-5">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left">
                <th className="border border-border px-3 py-2 font-medium">Description</th>
                <th className="border border-border px-3 py-2 font-medium">SAC</th>
                <th className="border border-border px-3 py-2 text-right font-medium">Taxable value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-3 py-2">{inv.description}</td>
                <td className="border border-border px-3 py-2 font-mono">{seller.sacCode}</td>
                <td className="border border-border px-3 py-2 text-right tabular-nums">{formatInr(inv.basePaise)}</td>
              </tr>
            </tbody>
          </table>

          <table className="ml-auto mt-4 w-full max-w-sm border-collapse">
            <tbody>
              <Row label="Taxable value" value={formatInr(inv.basePaise)} />
              {inv.split === "cgst_sgst" && (
                <>
                  <Row label={`CGST ${half}%`} value={formatInr(inv.cgstPaise)} />
                  <Row label={`SGST / UTGST ${half}%`} value={formatInr(inv.sgstPaise)} />
                </>
              )}
              {inv.split === "igst" && <Row label={`IGST ${inv.ratePercent}%`} value={formatInr(inv.igstPaise)} />}
              <Row label="Total" value={formatInr(inv.totalPaise)} strong />
            </tbody>
          </table>
          <p className="mt-4">
            <span className="text-muted">Amount in words: </span>
            <span className="font-medium">{amountInWords(inv.totalPaise)}</span>
          </p>
          <p className="mt-1 text-fg-soft">Paid in full on {date}. Tax payable on reverse charge: No.</p>
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted">
          <p>This is a computer-generated invoice and does not need a signature.</p>
          {!taxInvoice && <p className="mt-1">No GST was charged on this payment.</p>}
        </footer>
      </article>
    </div>
  );
}
