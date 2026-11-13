// The proof line from the Website Blueprint ("10,000+ businesses served by our team"), with a tick.
// Used on Pricing and Done-for-you; the homepage shows it under the check box. The text lives in BRAND.proof.
import clsx from "clsx";
import { Check } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function ProofLine({ className }: { className?: string }) {
  return (
    <p className={clsx("inline-flex items-center gap-2 text-small font-medium text-fg", className)}>
      <Check aria-hidden size={16} className="shrink-0 text-success" />
      {BRAND.proof}
    </p>
  );
}
