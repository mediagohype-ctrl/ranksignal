"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, FileText, Wrench } from "lucide-react";
import type { IssueImpact, Pillar, ReportIssue } from "@/lib/report/types";
import { EmptyState, IssueCard, LinkButton } from "@/components/ui";
import { PILLAR_ORDER, PILLAR_SHORT } from "./pillars";
import { pillarFullName } from "@/lib/report/score";
import { issueHref } from "@/components/app/nav";

type PillarFilter = Pillar | "all";
type ImpactFilter = IssueImpact | "all";

const IMPACTS: IssueImpact[] = ["high", "medium", "low"];
const IMPACT_LABEL: Record<IssueImpact, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };

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

const PRIORITY_TONE: Record<IssueImpact, string> = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  low: "bg-surface-2 text-muted",
};

/** "https://site.com/about" → "/about"; the home page → "Home page". */
function shortPath(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" && !u.search ? "Home page" : `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** One short row per problem with a "Quick look" dropdown; the problem itself opens on its own page. */
function IssueRow({ issue: i, href }: { issue: ReportIssue; href: string }) {
  const [open, setOpen] = useState(false);
  const pages = i.affectedCount;
  const sample = i.affectedUrls.slice(0, 3);
  const briefId = `brief-${i.id}`;
  return (
    <div id={i.id} className="rounded-2xl border border-border bg-surface shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-center gap-2 py-4 pl-5 pr-3 sm:gap-3">
        <Link href={href} className="focus-ring group min-w-0 flex-1 rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-semibold", PRIORITY_TONE[i.impact])}>
              {IMPACT_LABEL[i.impact]}
            </span>
            {pages > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <FileText size={12} aria-hidden /> {pages} {pages === 1 ? "page" : "pages"}
              </span>
            )}
          </div>
          <h4 className="mt-1.5 text-h4 text-fg group-hover:text-primary">{i.title}</h4>
          <p className={clsx("mt-0.5 text-small text-muted", !open && "line-clamp-1")}>{i.whatsWrong}</p>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={briefId}
          className="focus-ring inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-small font-medium text-fg-soft hover:bg-surface-2"
        >
          <span className="hidden sm:inline">{open ? "Hide" : "Quick look"}</span>
          <span className="sr-only sm:hidden">{open ? "Hide brief" : "Show brief"}</span>
          <ChevronDown size={16} aria-hidden className={clsx("transition-transform", open && "rotate-180")} />
        </button>
        <Link href={href} className="focus-ring hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-small font-medium text-primary sm:inline-flex">
          See problem <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      {open && (
        <div id={briefId} className="space-y-3 border-t border-border px-5 py-4">
          <div>
            <p className="text-caption uppercase tracking-[0.06em] text-muted">Why it matters</p>
            <p className="mt-1 text-small text-fg-soft">{i.whyItMatters}</p>
          </div>
          {sample.length > 0 && (
            <div>
              <p className="text-caption uppercase tracking-[0.06em] text-muted">For example on</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {sample.map((u) => (
                  <li key={u} className="inline-flex h-7 max-w-full items-center truncate rounded-full bg-surface-2 px-2.5 text-xs font-medium text-fg-soft">
                    {shortPath(u)}
                  </li>
                ))}
                {pages > sample.length && <li className="self-center text-xs text-muted">and {pages - sample.length} more</li>}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <LinkButton href={href} size="sm" iconRight={<ArrowRight />}>
              See the full problem
            </LinkButton>
            <LinkButton href={`${href}/fix`} size="sm" variant="secondary" icon={<Wrench />}>
              How to fix it
            </LinkButton>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Problem list with client-side area / priority filter chips. In the app each problem is a short row that opens
 * its own page; without `projectId` (shared client reports) the full cards are rendered instead.
 */
export function IssueList({
  issues,
  quickWins,
  projectId,
}: {
  issues: ReportIssue[];
  quickWins: string[];
  projectId?: string;
}) {
  const [pillar, setPillar] = useState<PillarFilter>("all");
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const quick = useMemo(() => new Set(quickWins), [quickWins]);

  // Jumping to #<issue id> (e.g. from the quick-wins strip) clears filters and opens that issue.
  useEffect(() => {
    function openFromHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !issues.some((i) => i.id === id)) return;
      if (projectId) {
        window.location.replace(issueHref(projectId, id));
        return;
      }
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
  }, [issues, projectId]);

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
        description="We didn't find anything to fix on the pages we checked. Check your website again after you make big changes."
        bordered
      />
    );
  }

  let n = 0;
  return (
    <div className="space-y-6">
      <div className="no-print space-y-3" role="group" aria-label="Filter problems">
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
          <span className="w-16 text-caption uppercase tracking-[0.06em] text-muted">Priority</span>
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
          Showing {shown.length} of {issues.length} {issues.length === 1 ? "problem" : "problems"}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No problems match these filters" description="Try a different area or priority." size="sm" bordered />
      ) : (
        groups.map((g) => (
          <section key={g.pillar} aria-labelledby={`issues-${g.pillar}`} className="space-y-4">
            <h3 id={`issues-${g.pillar}`} className="flex items-center gap-2 text-h4 text-fg">
              {pillarFullName(g.pillar)} problems
              <span className="text-small font-normal tabular-nums text-muted">({g.items.length})</span>
            </h3>
            {g.items.map((i) => {
              const idx = n++;
              if (projectId) return <IssueRow key={i.id} issue={i} href={issueHref(projectId, i.id)} />;
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
                    i.relatedActionType && projectId ? (
                      <LinkButton
                        href={`/app/projects/${projectId}/actions`}
                        size="sm"
                        variant="secondary"
                        icon={<Wrench />}
                        iconRight={<ArrowRight />}
                        className="no-print"
                      >
                        Draft this fix for approval
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
