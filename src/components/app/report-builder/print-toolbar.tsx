"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/app/print-button";
import { buttonClass } from "@/components/ui";

/** Toolbar for the printable built report; opens the print dialog once on load when `autoPrint`. Hidden in print. */
export function BuilderPrintToolbar({ backHref, autoPrint = true }: { backHref: string; autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 800);
    return () => window.clearTimeout(t);
  }, [autoPrint]);
  return (
    <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-small text-fg-soft">
        In the print window choose <strong>Save as PDF</strong> as the printer.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={backHref} className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden /> Back to the builder
        </Link>
        <PrintButton label="Save as PDF" variant="primary" />
      </div>
    </div>
  );
}
