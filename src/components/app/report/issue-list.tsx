"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Wrench } from "lucide-react";
import type { IssueImpact, Pillar, ReportIssue } from "@/lib/report/types";
import { EmptyState, IssueCard, LinkButton } from "@/components/ui";
import { PILLAR_ORDER, PILLAR_SHORT } from "./pillars";

type PillarFilter = Pillar | "all";
type ImpactFilter = IssueImpact | "all";

const IMPACTS: IssueImpact[] = ["high", "medium", "low"];
const IMPACT_LABEL: Record<IssueImpact, string> = { high: "High impact", medium: "Medium impact", low: "Low impact" };

function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={count === 0 && !active}
      className={clsx(
        "focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors disabled:opacity-40",
        active ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:bg-surface-2",
      )}
    >
      {children}
      <span className={clsx("tabular-nums text-xs", active ? "text-primary-soft-fg" : "text-muted")}>{count}</span>
    </button>
  );
}

/** Full "What's wrong & how to fix it" list with client-side pillar / impact filter chips. */
export function IssueList({
  issues,
  quickWins,
  projectId,
}: {
  issues: ReportIssue[];
  quickWins: string[];
  projectId: string;
}) {
  const [pillar, setPillar] = useState<PillarFilter>("all");
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const quick = useMemo(() => new Set(quickWins), [quickWins]);

  // Jumping to #<issue id> (e.g. from the quick-wins strip) clears filters and opens that issue.
  useEffect(() => {
    function openFromHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !issues.some((i) => i.id === id)) return;
      setPillar("all");
      setImpact("all");
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el instanceof HTMLDetailsElement) el.open = true;
        el?.scrollIntoView({ block: "start" });
      });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [issues]);

  const pillarCounts = useMemo(() => {
    const base = impact === "all" ? issues : issues.filter((i) => i.impact === impact);
    const c: Record<string, number> = { all: base.length };
    for (const i of base) c[i.pillar] = (c[i.pillar] ?? 0) + 1;
    return c;
  }, [issues, impact]);
  const impactCounts = useMemo(() => {
    const base = pillar === "all" ? issues : issues.filter((i) => i.pillar === pillar);
    const c: Record<string, number> = { all: base.length };
    for (const i of base) c[i.impact] = (c[i.impact] ?? 0) + 1;
    return c;
  }, [issues, pillar]);

  const shown = issues.filter((i) => (pillar === "all" || i.pillar === pillar) && (impact === "all" || i.impact === impact));
  const groups = (pillar === "all" ? PILLAR_ORDER : [pillar])
    .map((p) => ({ pillar: p, items: shown.filter((i) => i.pillar === p) }))
    .filter((g) => g.items.length > 0);

  if (issues.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title="No problems found"
        description="We didn't find anything to fix on the pages we scanned. Re-scan after you make big changes to your site."
        bordered
      />
    );
  }

  let n = 0;
  return (
    <div className="space-y-6">
      <div className="no-print space-y-3" role="group" aria-label="Filter issues">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-caption uppercase tracking-[0.06em] text-muted">Area</span>
          <Chip active={pillar === "all"} onClick={() => setPillar("all")} count={pillarCounts.all ?? 0}>
            All
          </Chip>
          {PILLAR_ORDER.map((p) => (
            <Chip key={p} active={pillar === p} onClick={() => setPillar(p)} count={pillarCounts[p] ?? 0}>
              {PILLAR_SHORT[p]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-caption uppercase tracking-[0.06em] text-muted">Impact</span>
          <Chip active={impact === "all"} onClick={() => setImpact("all")} count={impactCounts.all ?? 0}>
            All
          </Chip>
          {IMPACTS.map((i) => (
            <Chip key={i} active={impact === i} onClick={() => setImpact(i)} count={impactCounts[i] ?? 0}>
              {IMPACT_LABEL[i]}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          Showing {shown.length} of {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No issues match these filters" description="Try a different area or impact level." size="sm" bordered />
      ) : (
        groups.map((g) => (
          <section key={g.pillar} aria-labelledby={`issues-${g.pillar}`} className="space-y-4">
            <h3 id={`issues-${g.pillar}`} className="flex items-center gap-2 text-h4 text-fg">
              {PILLAR_SHORT[g.pillar]} issues
              <span className="text-small font-normal tabular-nums text-muted">({g.items.length})</span>
            </h3>
            {g.items.map((i) => {
              const idx = n++;
              return (
                <IssueCard
                  key={i.id}
                  {...i}
                  pillarLabel={PILLAR_SHORT[i.pillar]}
                  quickWin={quick.has(i.id)}
                  collapsible
                  defaultOpen={idx < 2}
                  className="scroll-mt-24 break-inside-avoid"
                  actions={
                    i.relatedActionType ? (
                      <LinkButton
                        href={`/app/projects/${projectId}/actions`}
                        size="sm"
                        variant="secondary"
                        icon={<Wrench />}
                        iconRight={<ArrowRight />}
                        className="no-print"
                      >
                        Draft this fix in Actions
                      </LinkButton>
                    ) : undefined
                  }
                />
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
