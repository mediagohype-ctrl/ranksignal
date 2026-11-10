// Invoices table on Settings → Billing (server component). Each row opens the printable GST invoice.
import Link from "next/link";
import { FileText } from "lucide-react";
import { formatInr } from "@/lib/billing/gst";
import { fmtDate } from "@/lib/dashboard/format";
import { Card, EmptyState, Table, TD, TH, THead, TR } from "@/components/ui";

export interface InvoiceRow {
  id: string;
  number: string;
  description: string;
  totalPaise: number;
  paidAt: Date;
}

export function InvoicesList({ invoices }: { invoices: InvoiceRow[] }) {
  if (!invoices.length) {
    return (
      <Card>
        <EmptyState size="sm" icon={<FileText />} title="No invoices yet" description="An invoice appears here after each payment." />
      </Card>
    );
  }
  return (
    <Card>
      <Table caption="Invoices" density="compact">
        <THead>
          <tr>
            <TH>Date</TH>
            <TH>Invoice</TH>
            <TH>For</TH>
            <TH align="right">Total</TH>
          </tr>
        </THead>
        <tbody>
          {invoices.map((i) => (
            <TR key={i.id}>
              <TD>{fmtDate(i.paidAt)}</TD>
              <TD>
                <Link href={`/app/settings/invoices/${i.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
                  {i.number}
                </Link>
              </TD>
              <TD className="text-fg-soft">{i.description}</TD>
              <TD numeric>{formatInr(i.totalPaise)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
