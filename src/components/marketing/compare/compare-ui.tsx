// Shared building blocks for the /compare pages, so every comparison reads the same way: a feature table, "where each
// is better", pricing with the date we checked, "which should you choose?", sources and a trademark note.
// Server components only. Competitor facts come from @/lib/compare/competitors (each with its source URL).
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, HelpCircle, X } from "lucide-react";
import { LinkButton, SectionHeading } from "@/components/ui";
import { Section } from "@/components/marketing/ui";
import { MARKETING_PLANS, SERVICE_FROM_PRICE, TRIAL_DAYS, gstOn, inr, priceNote } from "@/components/marketing/plans";
import { formatCheckedOn, formatFrom, trademarkNote, type Competitor } from "@/lib/compare/competitors";

/* ------------------------------------------------------------------ comparison table */

export type CellState = "yes" | "no" | "partial" | "unknown";
/** A table cell: a state (icon + label) or plain text, with an optional short note. */
export type Cell = { s: CellState; note?: string } | { text: string; note?: string };
export type Row = { label: string; cells: Cell[] };

const STATE: Record<CellState, { label: string; icon: ReactNode; cls: string }> = {
  yes: { label: "Yes", icon: <Check aria-hidden size={16} />, cls: "text-success" },
  no: { label: "No", icon: <X aria-hidden size={16} />, cls: "text-muted" },
  partial: { label: "Partly", icon: <CircleDashed aria-hidden size={16} />, cls: "text-warning" },
  unknown: { label: "Not listed", icon: <HelpCircle aria-hidden size={16} />, cls: "text-muted" },
};

function CellView({ cell }: { cell: Cell }) {
  return (
    <>
      {"s" in cell ? (
        <span className={`inline-flex items-center gap-1.5 font-medium ${STATE[cell.s].cls}`}>
          {STATE[cell.s].icon}
          {STATE[cell.s].label}
        </span>
      ) : (
        <span className="font-medium text-fg">{cell.text}</span>
      )}
      {cell.note && <span className="mt-1 block text-caption leading-snug text-muted">{cell.note}</span>}
    </>
  );
}

/**
 * Feature table. Only the table container scrolls sideways on narrow screens (the page never does); the first
 * column labels each row for screen readers.
 */
export function ComparisonTable({
  caption,
  columns,
  rows,
  minWidth = "40rem",
}: {
  caption: string;
  columns: string[];
  rows: Row[];
  /** Below this width the table scrolls inside its own box. */
  minWidth?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="w-full max-w-full overflow-x-auto rounded-2xl border border-border bg-surface focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table className="w-full border-collapse text-left text-small" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-surface-2 text-caption uppercase tracking-[0.05em] text-muted">
          <tr>
            <th scope="col" className="w-[28%] px-4 py-3 font-semibold">
              Feature
            </th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border align-top last:border-0">
              <th scope="row" className="px-4 py-3 font-medium text-fg">
                {r.label}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className="px-4 py-3">
                  <CellView cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Table section with a heading, the "checked on" line and a legend. */
export function TableSection({
  id,
  title,
  intro,
  competitors,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  competitors: Competitor[];
  children: ReactNode;
}) {
  return (
    <Section labelledBy={id}>
      <SectionHeading id={id} size="lg" eyebrow="Side by side" title={title} description={intro} />
      {children}
      <p className="mt-4 text-caption leading-relaxed text-muted">
        &quot;Partly&quot; means the feature exists with limits (see the note). &quot;Not listed&quot; means we could not
        confirm it on the competitor&apos;s own pages, so we don&apos;t claim either way.{" "}
        <CheckedOn competitors={competitors} />
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ sources + dates */

/** "Prices checked on 9 Nov 2026 from ahrefs.com/pricing." */
export function CheckedOn({ competitors }: { competitors: Competitor[] }) {
  const date = formatCheckedOn(competitors[0]?.checkedOn ?? "");
  return (
    <span>
      Prices checked on {date} from{" "}
      {competitors.map((c, i) => (
        <span key={c.id}>
          {i > 0 && (i === competitors.length - 1 ? " and " : ", ")}
          <a href={c.pricingUrl} rel="noopener nofollow" className="font-medium text-primary underline-offset-4 hover:underline">
            {c.pricingUrl.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        </span>
      ))}
      . Prices change, so check their site before you buy.
    </span>
  );
}

/** Every competitor fact used on the page, each linked to the page it came from. */
export function FactSources({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-bg p-6">
      <h3 className="text-h4 text-fg">Where the competitor facts come from</h3>
      <p className="mt-2 text-small text-muted">
        Read on each company&apos;s own public pages on {formatCheckedOn(competitors[0]?.checkedOn ?? "")}.
      </p>
      {competitors.map((c) => (
        <div key={c.id} className="mt-4">
          <p className="text-small font-semibold text-fg">{c.name}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-small leading-relaxed text-fg-soft">
            {c.facts.map((f) => (
              <li key={f.text}>
                {f.text}{" "}
                <a href={f.source} rel="noopener nofollow" className="text-primary underline-offset-4 hover:underline">
                  (source)
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TrademarkNote({ names }: { names?: readonly string[] }) {
  return (
    <div className="container-marketing pb-10">
      <p className="text-caption text-muted">{trademarkNote(names)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ where each is better */

export function StrengthsSection({
  id,
  theirName,
  theirs,
  ours,
}: {
  id: string;
  theirName: string;
  theirs: ReactNode[];
  ours: ReactNode[];
}) {
  const col = (title: string, items: ReactNode[], hid: string) => (
    <div className="min-w-0 rounded-2xl border border-border bg-bg p-6 sm:p-8">
      <h2 id={hid} className="text-h3 text-fg">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-body leading-relaxed text-fg-soft">
            <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Section labelledBy={`${id}-theirs`} tone="surface">
      <div className="grid gap-6 lg:grid-cols-2">
        {col(`Where ${theirName} is better`, theirs, `${id}-theirs`)}
        {col("Where MyWebRank is better", ours, `${id}-ours`)}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ pricing */

/** MyWebRank's plan prices, read from the same plan config the app enforces. */
export function OurPrices() {
  return (
    <ul className="mt-3 space-y-1.5 text-small text-fg-soft">
      {MARKETING_PLANS.map((p) => (
        <li key={p.id}>
          <span className="font-medium text-fg">{p.name}:</span> {inr(p.price)}
          {p.suffix ?? ""}/month{gstOn() ? " + GST" : ""} · {p.limits.maxProjects} website{p.limits.maxProjects === 1 ? "" : "s"} ·{" "}
          {p.ai.answersPerMonth.toLocaleString("en-IN")} AI answers a month
        </li>
      ))}
      <li>
        <span className="font-medium text-fg">Done-for-you service:</span> from {inr(SERVICE_FROM_PRICE)}/month plus a
        one-time setup fee
      </li>
      <li>
        {TRIAL_DAYS}-day free trial. {priceNote()}
        {gstOn() ? " We issue a GST invoice for every payment." : ""}
      </li>
    </ul>
  );
}

export function PricingSection({
  id,
  competitors,
  maxFacts = 4,
  children,
}: {
  id: string;
  competitors: Competitor[];
  /** How many pricing facts to list per competitor. */
  maxFacts?: number;
  /** A short paragraph comparing like with like. */
  children?: ReactNode;
}) {
  return (
    <Section labelledBy={id}>
      <SectionHeading id={id} size="lg" eyebrow="Pricing" title="What each one costs" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-6">
          <h3 className="text-h4 text-fg">MyWebRank (INR)</h3>
          <OurPrices />
        </div>
        {competitors.map((c) => (
          <div key={c.id} className="min-w-0 rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-h4 text-fg">
              {c.name} ({c.pricingFrom.amount === 0 ? "free" : c.pricingFrom.currency})
            </h3>
            <p className="mt-3 text-small text-fg-soft">
              <span className="font-medium text-fg">From {formatFrom(c)}</span> · {c.pricingFrom.note}
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small leading-relaxed text-fg-soft">
              {c.facts
                .filter((f) => f.source === c.pricingUrl)
                .slice(0, maxFacts)
                .map((f) => (
                  <li key={f.text}>{f.text}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {children && <div className="mt-6 max-w-3xl text-body leading-relaxed text-fg-soft">{children}</div>}
      <p className="mt-4 text-caption text-muted">
        <CheckedOn competitors={competitors} /> We show their prices in their own currency and don&apos;t convert them.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ which should you choose? */

export type Scenario = { situation: string; pick: string; why: string };

export function ChooseSection({ id, title = "Which should you choose?", scenarios }: { id: string; title?: string; scenarios: Scenario[] }) {
  return (
    <Section labelledBy={id} tone="surface">
      <SectionHeading id={id} size="lg" eyebrow="Decide" title={title} />
      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <div key={s.situation} className="min-w-0 rounded-2xl border border-border bg-bg p-6">
            <p className="text-small text-muted">{s.situation}</p>
            <p className="mt-2 text-h4 text-fg">Choose {s.pick}</p>
            <p className="mt-2 text-small leading-relaxed text-fg-soft">{s.why}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ CTA + hero buttons */

export function HeroButtons() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <LinkButton href="/free-check" size="lg" variant="accent" iconRight={<ArrowRight />}>
        Run the free check
      </LinkButton>
      <LinkButton href="/signup" size="lg" variant="secondary">
        Start {TRIAL_DAYS}-day free trial
      </LinkButton>
    </div>
  );
}

export function CompareCta() {
  return (
    <Section labelledBy="compare-cta">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 id="compare-cta" className="text-h3 text-fg">
          See what MyWebRank finds on your website
        </h2>
        <p className="mt-3 text-body text-fg-soft">
          The <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">free check</Link>{" "}
          needs no sign-up. The {TRIAL_DAYS}-day trial adds AI answer tracking and fixes you approve. We never promise a Google
          position.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/free-check" size="lg" variant="primary" iconRight={<ArrowRight />}>
            Run the free check
          </LinkButton>
          <LinkButton href="/signup" size="lg" variant="secondary">
            Start free trial
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
