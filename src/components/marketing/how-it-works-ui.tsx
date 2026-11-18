// Product UI vignettes for /how-it-works. Built from the real ui primitives and tokens, in the same
// language as home-ui.tsx. Every business, number and answer shown here is sample
// data for a fictional bakery and is labelled as such.
import clsx from "clsx";
import { ArrowRight, Check, ClipboardCopy, Download, Minus, Plus } from "lucide-react";
import { Meter } from "@/components/ui";
import { SampleTag } from "./home-ui";
import { SELF_PLAN } from "./plans";

const DOMAIN = "greenleaf-bakery.example";

/** Shared card shell: header with title, sub-line and the Sample tag. */
export function Panel({
  title,
  sub,
  aside,
  children,
  className,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("relative overflow-hidden rounded-[22px] border border-border bg-surface shadow-lg", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-fg">{title}</p>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {aside}
          <SampleTag />
        </div>
      </div>
      {children}
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "primary" | "dashed" }) {
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        tone === "primary" && "border border-primary/30 bg-primary-soft text-primary-soft-fg",
        tone === "plain" && "border border-border text-fg-soft",
        tone === "dashed" && "border border-dashed border-border-strong text-muted",
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ 02 · audit and measure */

const BASELINE_PILLARS = [
  { label: "SEO", plain: "Google Score", score: 66 },
  { label: "AEO", plain: "Answer Score", score: 31 },
  { label: "GEO", plain: "AI Score", score: 24 },
  { label: "Brand", plain: "Trust Score", score: 72 },
] as const;

/** One AI check on Do it myself, from the plan limits (so the picture matches what the plan really does). */
const CHECK_ANSWERS = SELF_PLAN.ai.questionsPerCheck * SELF_PLAN.ai.engines;
const NAMED = Math.round(CHECK_ANSWERS * 0.15);
const LINKED = Math.round(CHECK_ANSWERS * 0.07);
const pct = (n: number) => `${Math.round((n / CHECK_ANSWERS) * 100)}%`;

export function BaselineVignette() {
  return (
    <Panel title="Your first check" sub={`28 May · ${DOMAIN}`}>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          42 pages read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          Robot rules followed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          {CHECK_ANSWERS} AI answers saved
        </span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <ul className="space-y-3 border-b border-border px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
          {BASELINE_PILLARS.map((p) => (
            <li key={p.label} className="grid grid-cols-[6.25rem_1fr_1.75rem] items-center gap-2 text-xs">
              <span className="leading-tight">
                <span className="block font-medium text-fg">{p.label}</span>
                <span className="block text-[11px] text-muted">{p.plain}</span>
              </span>
              <Meter value={p.score} max={100} label={`Sample ${p.label} score`} tone="score" size="sm" />
              <span className="text-right tabular-nums text-fg-soft">{p.score}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2">
          {[
            { label: "AI named you", value: pct(NAMED), range: `named in ${NAMED}` },
            { label: "AI linked to you", value: pct(LINKED), range: `linked in ${LINKED}` },
          ].map((s, i) => (
            <div key={s.label} className={clsx("px-5 py-5 sm:px-6", i > 0 && "border-l border-border")}>
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-2">
                <span className="block text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">{s.value}</span>
                <span className="mt-2 block text-[11px] leading-snug text-muted">
                  {s.range}
                  <br />
                  from {CHECK_ANSWERS} answers
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-muted sm:px-6">
        {SELF_PLAN.ai.questionsPerCheck} questions, each asked once on each of {SELF_PLAN.ai.engines} AI assistants. Small samples move a lot,
        so the sample size is shown.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 03 · review prioritised fixes */

const QUEUE: { title: string; impact: string; effort: string }[] = [
  { title: "Answer “Do you deliver?” on the homepage", impact: "High impact", effort: "Quick fix" },
  { title: "Add info for Google and AI to the custom-cakes page", impact: "High impact", effort: "Quick fix" },
  { title: "Write a page for the sugar-free range", impact: "Medium impact", effort: "Bigger job" },
  { title: "Redirect the old menu PDF to the menu page", impact: "Low impact", effort: "Quick fix" },
];

export function FixQueueVignette() {
  return (
    <Panel title="To-do list" sub="12 fixes · most useful first">
      <ol>
        {QUEUE.map((q, i) => (
          <li key={q.title} className="grid grid-cols-[1.5rem_1fr] gap-3 border-b border-border px-5 py-4 sm:grid-cols-[1.5rem_1fr_auto] sm:items-center sm:px-6">
            <span className="pt-px text-small tabular-nums text-muted">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-small font-medium leading-snug text-fg">{q.title}</span>
              <span className="mt-1 block text-xs text-muted">
                {q.impact} · {q.effort}
              </span>
            </span>
            <span className="col-start-2 sm:col-start-auto">
              <Chip tone="primary">Ready to paste</Chip>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 bg-surface-2/60 px-5 py-3.5 text-xs leading-relaxed text-fg-soft sm:px-6">
        <ClipboardCopy aria-hidden size={13} className="mt-0.5 shrink-0 text-muted" />
        <span>
          <span className="font-semibold text-fg">Each fix opens with the exact words to paste</span> and where to put them
          on your kind of website.
        </span>
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ every month · the impact report */

type Who = "Our team" | "You";
const WHO_STYLE: Record<Who, string> = {
  "Our team": "bg-fg text-bg",
  You: "border border-border-strong text-fg",
};
function WhoChip({ who }: { who: Who }) {
  return <span className={clsx("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium", WHO_STYLE[who])}>{who}</span>;
}

export function ImpactReportVignette() {
  return (
    <Panel
      title="October report"
      sub={`Emailed 1 Nov · ${DOMAIN}`}
      aside={
        <span aria-hidden className="hidden h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-fg-soft sm:inline-flex">
          <Download size={13} />
          Save as PDF
        </span>
      }
      className="shadow-xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Measured */}
        <div className="border-b border-border px-5 py-5 sm:px-6 md:border-b-0 md:border-r">
          <p className="text-small font-semibold text-fg">What we measured</p>
          <p className="mt-4 text-xs text-muted">Overall score, since September</p>
          <p className="mt-2 flex items-baseline gap-2.5">
            <span className="text-[1.25rem] font-medium leading-none tabular-nums text-muted">58</span>
            <ArrowRight aria-hidden size={15} className="self-center text-muted" />
            <span className="text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">65</span>
            <span className="inline-flex h-7 items-center self-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">+7</span>
          </p>
          <p className="mt-5 text-xs text-muted">Same {SELF_PLAN.ai.questionsPerCheck} questions as September</p>
          <ul className="mt-1.5">
            {[
              { q: "Eggless birthday cake near Indiranagar", won: true },
              { q: "Same-day cake delivery in Bengaluru", won: true },
              { q: "Best bakery for a custom wedding cake", won: false },
            ].map((r) => (
              <li key={r.q} className="flex items-start gap-2.5 border-b border-border py-2.5 text-small leading-snug text-fg-soft">
                <span
                  aria-hidden
                  className={clsx(
                    "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full",
                    r.won ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                  )}
                >
                  {r.won ? <Plus size={12} strokeWidth={2.75} /> : <Minus size={12} strokeWidth={2.75} />}
                </span>
                <span>
                  <span className="sr-only">{r.won ? "Won: " : "Lost: "}</span>
                  {r.q}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-fg-soft">
            <span className="font-semibold text-fg">Wrong answer caught:</span> Gemini says you close at 6 pm. Your site says 9 pm.
          </p>
        </div>
        {/* Shipped */}
        <div className="px-5 py-5 sm:px-6">
          <p className="text-small font-semibold text-fg">Fixes done</p>
          <ul className="mt-2">
            {(
              [
                { t: "Delivery areas answered on the homepage", who: "You" },
                { t: "Google summary updated on the custom-cakes page", who: "You" },
                { t: "Opening hours fixed on Google Business Profile", who: "You" },
                { t: "“Eggless cakes” page refreshed", who: "Our team" },
              ] as { t: string; who: Who }[]
            ).map((s) => (
              <li key={s.t} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0">
                <span className="flex gap-2.5 text-small leading-snug text-fg-soft">
                  <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-success" />
                  {s.t}
                </span>
                <WhoChip who={s.who} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="border-t border-border bg-surface-2/60 px-5 py-3.5 text-xs leading-relaxed text-muted sm:px-6">
        How to read this: the changes happened in the same month as the work listed. That doesn&apos;t prove one caused
        the other.
      </p>
    </Panel>
  );
}
