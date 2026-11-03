import { ShieldCheck } from "lucide-react";
import { RiskBadge } from "@/components/ui";

const ROWS = [
  { c: "A", text: "Safe: we only prepare a plan or a task. Nothing on your website changes." },
  { c: "B", text: "Needs your OK: a change to your website. It goes live only after you approve it." },
];

/** Compact explainer of "Safe" vs "Needs your OK", shown above the action list. */
export function RiskLegend() {
  return (
    <section aria-labelledby="risk-legend" className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-5">
      <h2 id="risk-legend" className="mb-3 flex items-center gap-2 text-small font-semibold text-fg">
        <ShieldCheck aria-hidden className="size-4 text-primary" />
        What needs your OK
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ROWS.map((r) => (
          <li key={r.c} className="flex items-start gap-2.5">
            <RiskBadge riskClass={r.c} className="mt-px shrink-0" />
            <span className="text-caption font-normal text-fg-soft">{r.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption font-normal text-muted">
        Payments, web addresses and legal pages are never changed for you — we give you the steps instead. Every change saves the old
        version first, so it can be undone.
      </p>
    </section>
  );
}
