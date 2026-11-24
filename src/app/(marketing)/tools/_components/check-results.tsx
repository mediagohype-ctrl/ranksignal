// Plain-words result list for the file/code checkers (llms.txt checker, FAQ schema checker): one line per check,
// marked ✓ / ! / ✗, each with its next step. Results are built from visitor text but rendered as React text only.
import clsx from "clsx";
import type { CheckItem } from "@/lib/tools/llms-txt-check";

const MARK = {
  ok: { sign: "✓", label: "Good", cls: "bg-success-soft text-success" },
  warn: { sign: "!", label: "Worth fixing", cls: "bg-warning-soft text-warning" },
  error: { sign: "✗", label: "Must fix", cls: "bg-danger-soft text-danger" },
} as const;

// Problems first, then things to check, then what is already fine.
const ORDER = { error: 0, warn: 1, ok: 2 } as const;

export function CheckResults({ title, items, errors, warnings }: { title: string; items: CheckItem[]; errors: number; warnings: number }) {
  const sorted = [...items].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const summary =
    errors === 0 && warnings === 0
      ? "Everything we check looks right."
      : [errors ? `${errors} ${errors === 1 ? "thing" : "things"} to fix` : "", warnings ? `${warnings} worth checking` : ""].filter(Boolean).join(", ") + ".";
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-h4 text-fg">{title}</h2>
      <p className={clsx("mt-1 text-small font-medium", errors ? "text-danger" : warnings ? "text-warning" : "text-success")}>{summary}</p>
      <ul className="mt-4 divide-y divide-border">
        {sorted.map((it) => {
          const m = MARK[it.level];
          return (
            <li key={it.id} className="flex items-start gap-3 py-3">
              <span aria-hidden className={clsx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-small font-bold", m.cls)}>
                {m.sign}
              </span>
              <span className="min-w-0">
                <span className="sr-only">{m.label}: </span>
                <span className="block break-words text-small font-medium text-fg">{it.title}</span>
                <span className="mt-0.5 block break-words text-small text-muted">{it.fix}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
