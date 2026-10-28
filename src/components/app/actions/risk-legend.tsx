import { ShieldCheck } from "lucide-react";
import { RiskBadge } from "@/components/ui";

const ROWS = [
  { c: "A", text: "Prepares a document or task only. Never touches your website." },
  { c: "B", text: "Small, undoable edits. Applied automatically only for types you allow; otherwise needs approval." },
  { c: "C", text: "Changes what visitors read. Always needs someone to approve the exact text." },
  { c: "D", text: "Too risky to automate (payments, URLs, legal claims). Done by hand only." },
];

/** Compact explainer of the four risk classes, shown above the action list. */
export function RiskLegend() {
  return (
    <section aria-labelledby="risk-legend" className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-5">
      <h2 id="risk-legend" className="mb-3 flex items-center gap-2 text-small font-semibold text-fg">
        <ShieldCheck aria-hidden className="size-4 text-primary" />
        How we decide what needs approval
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROWS.map((r) => (
          <li key={r.c} className="flex items-start gap-2.5">
            <RiskBadge riskClass={r.c} className="mt-px shrink-0" />
            <span className="text-caption font-normal text-fg-soft">{r.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption font-normal text-muted">
        Every applied change saves the previous version first, so it can be rolled back.
      </p>
    </section>
  );
}
