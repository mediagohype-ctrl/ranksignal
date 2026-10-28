import Link from "next/link";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  Gauge,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import { ScoreRing } from "./score";

/* ---------------------------------------------------------------- checks */

export type CheckStatus = "pass" | "warn" | "fail" | "not_measured";

const CHECK: Record<CheckStatus, { Icon: typeof CheckCircle2; cls: string; label: string }> = {
  pass: { Icon: CheckCircle2, cls: "text-success", label: "Passed" },
  warn: { Icon: AlertTriangle, cls: "text-warning", label: "Needs attention" },
  fail: { Icon: XCircle, cls: "text-danger", label: "Failed" },
  not_measured: { Icon: CircleDashed, cls: "text-muted", label: "Not measured" },
};

export function CheckStatusIcon({ status, size = 16, className }: { status: CheckStatus | string; size?: number; className?: string }) {
  const c = CHECK[status as CheckStatus] ?? CHECK.not_measured;
  return (
    <span role="img" aria-label={c.label} className={clsx("inline-flex shrink-0", c.cls, className)}>
      <c.Icon aria-hidden size={size} />
    </span>
  );
}

export interface CheckItem {
  id?: string;
  label: React.ReactNode;
  status: CheckStatus | string;
  /** One plain-English line with numbers. */
  detail?: React.ReactNode;
}

export function CheckList({ checks, dense, className }: { checks: CheckItem[]; dense?: boolean; className?: string }) {
  return (
    <ul className={clsx("divide-y divide-border", className)}>
      {checks.map((c, i) => (
        <li key={c.id ?? i} className={clsx("flex items-start gap-2.5", dense ? "py-1.5" : "py-2.5")}>
          <CheckStatusIcon status={c.status} className="mt-0.5" />
          <div className="min-w-0">
            <div className="text-small font-medium text-fg">{c.label}</div>
            {c.detail && !dense && <div className="text-xs leading-relaxed text-muted">{c.detail}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- pillar card */

/**
 * Pillar summary: name, score ring, one-line summary, check list.
 * Prop names match `PillarScore` from @/lib/report/types, so `<PillarCard {...pillar} />` works.
 */
export function PillarCard({
  label,
  score,
  grade,
  summary,
  checks = [],
  icon,
  href,
  linkLabel = "See details",
  maxChecks = 5,
  className,
}: {
  label: React.ReactNode;
  score: number | null;
  grade?: string | null;
  summary?: React.ReactNode;
  checks?: CheckItem[];
  icon?: React.ReactNode;
  /** Adds a "See details" link at the bottom. */
  href?: string;
  linkLabel?: string;
  /** Show at most N checks (fails/warns first). 0 hides the list. */
  maxChecks?: number;
  className?: string;
}) {
  const order: Record<string, number> = { fail: 0, warn: 1, not_measured: 2, pass: 3 };
  const sorted = [...checks].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).slice(0, maxChecks);
  const counts = checks.reduce<Record<string, number>>((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {});
  const name = typeof label === "string" ? label : "Pillar";
  return (
    <article className={clsx("flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && (
              <span aria-hidden className="text-primary [&_svg]:size-[18px]">
                {icon}
              </span>
            )}
            <h3 className="text-h4 text-fg">{label}</h3>
          </div>
          {summary && <p className="mt-1.5 text-small leading-relaxed text-muted">{summary}</p>}
        </div>
        <ScoreRing score={score} grade={grade} size="md" label={`${name} score`} />
      </div>
      {checks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          {(["pass", "warn", "fail"] as const).map((s) =>
            counts[s] ? (
              <span key={s} className="inline-flex items-center gap-1">
                <CheckStatusIcon status={s} size={13} />
                <span className="tabular-nums">{counts[s]}</span> {s === "pass" ? "passed" : s === "warn" ? "to improve" : "failing"}
              </span>
            ) : null,
          )}
        </div>
      )}
      {maxChecks > 0 && sorted.length > 0 && <CheckList checks={sorted} className="mt-3 border-t border-border" />}
      {href && (
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1 pt-4 text-small font-medium text-primary hover:underline underline-offset-4"
        >
          {linkLabel}
          <ArrowRight aria-hidden size={15} />
        </Link>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------- chips */

export type IssueImpact = "high" | "medium" | "low";
export type IssueEffort = "quick" | "moderate" | "involved";

const IMPACT: Record<IssueImpact, { cls: string; label: string }> = {
  high: { cls: "bg-danger-soft text-danger", label: "High impact" },
  medium: { cls: "bg-warning-soft text-warning", label: "Medium impact" },
  low: { cls: "bg-info-soft text-info", label: "Low impact" },
};
const EFFORT: Record<IssueEffort, { cls: string; label: string }> = {
  quick: { cls: "bg-success-soft text-success", label: "Quick fix" },
  moderate: { cls: "bg-surface-2 text-fg-soft", label: "Moderate effort" },
  involved: { cls: "bg-surface-2 text-fg-soft", label: "Bigger project" },
};
const chip = "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none";

export function ImpactChip({ impact }: { impact: IssueImpact | string }) {
  const c = IMPACT[impact as IssueImpact] ?? IMPACT.low;
  return (
    <span className={clsx(chip, c.cls)}>
      <Gauge aria-hidden size={12} />
      {c.label}
    </span>
  );
}

export function EffortChip({ effort }: { effort: IssueEffort | string }) {
  const c = EFFORT[effort as IssueEffort] ?? EFFORT.moderate;
  return (
    <span className={clsx(chip, c.cls)}>
      <Timer aria-hidden size={12} />
      {c.label}
    </span>
  );
}

/* ---------------------------------------------------------------- issue card */

/**
 * Plain-English issue. Prop names match `ReportIssue` from @/lib/report/types,
 * so `<IssueCard {...issue} />` works. Add `actions` for e.g. a "Draft this fix" button.
 * `collapsible` renders a native <details> (works in server components).
 */
export function IssueCard({
  id,
  title,
  whatsWrong,
  whyItMatters,
  howToFix = [],
  impact,
  effort,
  affectedUrls = [],
  affectedCount,
  evidence,
  pillarLabel,
  quickWin,
  actions,
  collapsible,
  defaultOpen,
  className,
}: {
  id?: string;
  title: React.ReactNode;
  whatsWrong?: React.ReactNode;
  whyItMatters?: React.ReactNode;
  howToFix?: React.ReactNode[];
  impact: IssueImpact | string;
  effort: IssueEffort | string;
  affectedUrls?: string[];
  affectedCount?: number;
  evidence?: React.ReactNode;
  /** e.g. "SEO" — shown as a small tag. */
  pillarLabel?: React.ReactNode;
  /** Adds a "Quick win" highlight. */
  quickWin?: boolean;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  const total = affectedCount ?? affectedUrls.length;
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {quickWin && (
            <span className={clsx(chip, "bg-accent-soft text-accent")}>
              <Zap aria-hidden size={12} />
              Quick win
            </span>
          )}
          <ImpactChip impact={impact} />
          <EffortChip effort={effort} />
          {pillarLabel && <span className={clsx(chip, "border border-border text-muted")}>{pillarLabel}</span>}
        </div>
        <h3 className="text-h4 text-fg">{title}</h3>
        {total > 0 && (
          <p className="mt-0.5 text-xs text-muted">
            Affects {total} {total === 1 ? "page" : "pages"}
          </p>
        )}
      </div>
      {collapsible && (
        <ChevronDown aria-hidden size={18} className="mt-1 shrink-0 text-muted transition-transform group-open/issue:rotate-180" />
      )}
    </div>
  );

  const body = (
    <div className="mt-4 space-y-4 text-small leading-relaxed text-fg-soft">
      {whatsWrong && (
        <section>
          <h4 className="mb-1 text-caption uppercase tracking-[0.06em] text-muted">What&apos;s wrong</h4>
          <p>{whatsWrong}</p>
        </section>
      )}
      {whyItMatters && (
        <section>
          <h4 className="mb-1 text-caption uppercase tracking-[0.06em] text-muted">Why it matters</h4>
          <p>{whyItMatters}</p>
        </section>
      )}
      {howToFix.length > 0 && (
        <section>
          <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-muted">How to fix</h4>
          <ol className="space-y-2">
            {howToFix.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {evidence && (
        <section className="rounded-lg border border-border bg-surface-2 px-3 py-2">
          <h4 className="mb-0.5 text-caption uppercase tracking-[0.06em] text-muted">Evidence</h4>
          <div className="break-words font-mono text-xs text-fg-soft">{evidence}</div>
        </section>
      )}
      {affectedUrls.length > 0 && (
        <details className="group/urls rounded-lg border border-border">
          <summary className="flex list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-small font-medium text-fg hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <span>
              Affected pages{" "}
              <span className="font-normal text-muted">
                ({affectedUrls.length}
                {total > affectedUrls.length ? ` of ${total} shown` : ""})
              </span>
            </span>
            <ChevronDown aria-hidden size={16} className="text-muted transition-transform group-open/urls:rotate-180" />
          </summary>
          <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-border px-3 py-2">
            {affectedUrls.map((u) => (
              <li key={u} className="min-w-0">
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
                >
                  <span className="truncate">{u}</span>
                  <ExternalLink aria-hidden size={11} className="shrink-0" />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {actions && <div className="flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div>}
    </div>
  );

  const box = clsx("rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6", className);

  if (collapsible) {
    return (
      <details id={id} open={defaultOpen} className={clsx("group/issue", box)}>
        <summary className="-m-2 list-none rounded-xl p-2 [&::-webkit-details-marker]:hidden">{header}</summary>
        {body}
      </details>
    );
  }
  return (
    <article id={id} className={box}>
      {header}
      {body}
    </article>
  );
}
