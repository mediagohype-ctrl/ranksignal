import { ArrowRight, Zap } from "lucide-react";
import type { ReportIssue } from "@/lib/report/types";
import { EffortChip, ImpactChip } from "@/components/ui";
import { PILLAR_SHORT } from "./pillars";

/** "Fix these first" strip: compact links that jump to (and open) the full issue below. */
export function QuickWins({ issues }: { issues: ReportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {issues.map((i, n) => (
        <li key={i.id} className="break-inside-avoid">
          <a
            href={`#${encodeURIComponent(i.id)}`}
            className="focus-ring group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              >
                {n + 1}
              </span>
              <span className="inline-flex items-center gap-1 text-caption uppercase tracking-[0.06em] text-accent">
                <Zap aria-hidden size={12} /> Quick win · {PILLAR_SHORT[i.pillar]}
              </span>
            </div>
            <h3 className="mt-3 text-h4 text-fg">{i.title}</h3>
            <p className="mt-1 line-clamp-2 text-small text-muted">{i.howToFix[0] ?? i.whatsWrong}</p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
              <ImpactChip impact={i.impact} />
              <EffortChip effort={i.effort} />
              <ArrowRight aria-hidden size={16} className="no-print ml-auto text-muted transition-transform group-hover:translate-x-0.5" />
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}
