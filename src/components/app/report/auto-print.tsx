"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/app/print-button";
import { buttonClass } from "@/components/ui";

/**
 * Toolbar for the printable full report: opens the browser's print dialog once the page has loaded
 * (choose "Save as PDF" there). Hidden in the printout itself.
 */
export function PrintToolbar({ backHref }: { backHref: string }) {
  useEffect(() => {
    // Let fonts and layout settle so the first page isn't printed half-styled.
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLDetailsElement>("details:not([open])").forEach((d) => (d.open = true));
      window.print();
    }, 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-small text-fg-soft">
        This is your complete report. In the print window choose <strong>Save as PDF</strong> as the printer.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={backHref} className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden /> Back to report
        </Link>
        <PrintButton label="Save as PDF" variant="primary" />
      </div>
    </div>
  );
}
