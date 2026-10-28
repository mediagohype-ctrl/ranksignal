"use client";
import { Printer } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui";

/**
 * Opens the browser print dialog (users can "Save as PDF" there).
 * Before printing, every collapsed <details> on the page is opened so the printout is complete,
 * then restored afterwards.
 */
export function PrintButton({
  label = "Print / PDF",
  variant = "secondary",
  size = "md",
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  function print() {
    const closed = Array.from(document.querySelectorAll<HTMLDetailsElement>("details:not([open])"));
    closed.forEach((d) => (d.open = true));
    const restore = () => {
      closed.forEach((d) => (d.open = false));
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  return (
    <Button variant={variant} size={size} icon={<Printer />} onClick={print} className="no-print">
      {label}
    </Button>
  );
}
