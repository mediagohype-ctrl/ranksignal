// Product UI vignettes for /how-it-works. Built from the real ui primitives and tokens, in the same
// language as home-ui.tsx and home-proof.tsx. Every business, number and answer shown here is sample
// data for a fictional bakery and is labelled as such.
import clsx from "clsx";
import { ArrowRight, Check, Download, Minus, Pencil, Plus, RotateCcw } from "lucide-react";
import { Meter, RiskBadge } from "@/components/ui";
import { ApprovalPanel, SampleTag } from "./home-ui";

const DOMAIN = "greenleaf-bakery.example";

/** Shared card shell: header with title, sub-line and the Sample tag. */
function Panel({
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

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "primary" | "dashed" }) {
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

/* ------------------------------------------------------------------ 01 · connect */

export function SetupVignette() {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Website", value: <span className="font-medium text-fg">{DOMAIN}</span> },
    { label: "Brand name", value: <span className="font-medium text-fg">Greenleaf Bakery</span> },
    {
      label: "Market",
      value: (
        <span className="flex flex-wrap gap-1.5">
          <Chip>India · English</Chip>
        </span>
      ),
    },
    {
      label: "Competitors",
      value: (
        <span className="flex flex-wrap gap-1.5">
          <Chip>Crumb &amp; Co.</Chip>
          <Chip>Sugar Lane</Chip>
          <Chip tone="dashed">
            <Plus aria-hidden size={12} />
            Add later
          </Chip>
        </span>
      ),
    },
  ];
  return (
    <Panel title="Set up your project" sub="Takes a couple of minutes">
      <dl className="px-5 sm:px-6">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1.5 border-b border-border py-3.5 text-small sm:grid-cols-[7.5rem_1fr] sm:items-center sm:gap-4">
            <dt className="text-muted">{r.label}</dt>
            <dd className="min-w-0">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-2/60 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-small font-medium text-fg">WordPress connected</p>
          <p className="text-xs text-muted">Nothing changes until you approve it.</p>
        </div>
        <p className="flex items-center gap-2.5 text-small text-fg-soft">
          Auto-apply
          <span aria-hidden className="relative inline-flex h-6 w-10 items-center rounded-full bg-border-strong">
            <span className="absolute left-0.5 size-5 rounded-full bg-surface shadow-sm" />
          </span>
          <span className="font-medium text-fg">Off</span>
        </p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 02 · audit and measure */

const BASELINE_PILLARS = [
  { label: "SEO", score: 66 },
  { label: "AEO", score: 31 },
  { label: "GEO", score: 24 },
  { label: "Brand", score: 72 },
] as const;

export function BaselineVignette() {
  return (
    <Panel title="Your first baseline" sub={`28 May · ${DOMAIN}`}>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          42 pages read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          robots.txt respected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={2.5} className="text-success" />
          200 AI answers saved
        </span>
      </p>
      <div className="grid sm:grid-cols-2">
        <ul className="space-y-3 border-b border-border px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
          {BASELINE_PILLARS.map((p) => (
            <li key={p.label} className="grid grid-cols-[3.25rem_1fr_1.75rem] items-center gap-2 text-xs">
              <span className="font-medium text-fg">{p.label}</span>
              <Meter value={p.score} max={100} label={`Sample ${p.label} score`} tone="score" size="sm" />
              <span className="text-right tabular-nums text-fg-soft">{p.score}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2">
          {[
            { label: "Mention rate", value: "14%", range: "named in 28" },
            { label: "Citation rate", value: "6%", range: "linked in 12" },
          ].map((s, i) => (
            <div key={s.label} className={clsx("px-5 py-5 sm:px-6", i > 0 && "border-l border-border")}>
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-2">
                <span className="block text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">{s.value}</span>
                <span className="mt-2 block text-[11px] leading-snug text-muted">
                  {s.range}
                  <br />
                  from 200 answers
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-muted sm:px-6">
        50 questions, each asked once on each of 4 AI assistants. Small samples move a lot, so the sample size is shown.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 03 · review prioritised fixes */

const QUEUE: { title: string; impact: string; effort: string; risk: "A" | "B" | "C" | "D" }[] = [
  { title: "Answer “Do you deliver?” on the homepage", impact: "High impact", effort: "Quick fix", risk: "C" },
  { title: "Add FAQ markup to the custom-cakes page", impact: "High impact", effort: "Quick fix", risk: "C" },
  { title: "Write a page for the sugar-free range", impact: "Medium impact", effort: "Bigger job", risk: "C" },
  { title: "Redirect the old menu PDF to the menu page", impact: "Low impact", effort: "Quick fix", risk: "D" },
];

export function FixQueueVignette() {
  return (
    <Panel title="Fix list" sub="12 fixes · most useful first">
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
              <RiskBadge riskClass={q.risk} />
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 bg-surface-2/60 px-5 py-3.5 text-xs leading-relaxed text-fg-soft sm:px-6">
        <Pencil aria-hidden size={13} className="mt-0.5 shrink-0 text-muted" />
        <span>
          <span className="font-semibold text-fg">You edited fix 1.</span> Its earlier approval was cleared, so you approve the
          new wording.
        </span>
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 04 · approve, publish, re-measure */

export function ShipComposition() {
  return (
    <figure aria-label="Sample: approving an exact change, then the follow-up measurement" className="relative">
      <div className="relative z-10 lg:mr-[12%]">
        <ApprovalPanel />
      </div>
      <div className="relative z-20 ml-6 mt-4 rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:ml-auto sm:w-[72%] sm:p-6 lg:-mr-4 lg:w-[58%]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Next AI check</p>
          <SampleTag />
        </div>
        <p className="mt-1 text-small font-medium text-fg">“Do you deliver to Domlur?”</p>
        <p className="mt-3 flex items-baseline gap-2.5">
          <span className="text-[1.25rem] font-medium leading-none tabular-nums text-muted">1 of 4</span>
          <ArrowRight aria-hidden size={15} className="self-center text-muted" />
          <span className="text-[2.25rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">3 of 4</span>
        </p>
        <p className="mt-2 text-xs text-muted">AI assistants that named you, before and after</p>
        <p className="mt-4 border-t border-border pt-3 text-xs text-fg-soft">Observed change, not proven cause.</p>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ every month · the impact report */

type Who = "Our team" | "You" | "Automated";
const WHO_STYLE: Record<Who, string> = {
  "Our team": "bg-fg text-bg",
  You: "border border-border-strong text-fg",
  Automated: "bg-primary-soft text-primary-soft-fg",
};
function WhoChip({ who }: { who: Who }) {
  return <span className={clsx("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium", WHO_STYLE[who])}>{who}</span>;
}

export function ImpactReportVignette() {
  return (
    <Panel
      title="October impact report"
      sub={`Emailed 1 Nov · ${DOMAIN}`}
      aside={
        <span aria-hidden className="hidden h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-fg-soft sm:inline-flex">
          <Download size={13} />
          Save as PDF
        </span>
      }
      className="shadow-xl"
    >
      <div className="grid md:grid-cols-2">
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
          <p className="mt-5 text-xs text-muted">Same 50 questions as September</p>
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
          <p className="text-small font-semibold text-fg">What shipped</p>
          <ul className="mt-2">
            {(
              [
                { t: "Delivery areas answered on the homepage", who: "Automated" },
                { t: "Meta description updated on the custom-cakes page", who: "Automated" },
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
        How to read this: the changes were measured in the same month as the work listed. That is correlation, not proof that
        one caused the other.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ runs on its own */

const HISTORY = [
  { m: "May", v: 44 },
  { m: "Jun", v: 47 },
  { m: "Jul", v: 51, method: true },
  { m: "Aug", v: 53 },
  { m: "Sep", v: 58 },
  { m: "Oct", v: 65 },
];

export function ScheduleVignette() {
  const rows = [
    { what: "Site re-scan", how: "Weekly", next: "Next: Mon 3 Nov" },
    { what: "AI check", how: "Monthly", next: "Next: Sat 1 Nov" },
    { what: "“Report ready” email", how: "On", next: "Owners and admins" },
  ];
  return (
    <Panel title="Schedule" sub={DOMAIN}>
      <dl className="px-5 sm:px-6">
        {rows.map((r) => (
          <div key={r.what} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-border py-3 text-small">
            <dt className="font-medium text-fg">{r.what}</dt>
            <dd className="row-span-2 inline-flex h-7 items-center justify-self-end rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary-soft-fg">
              {r.how}
            </dd>
            <dd className="text-xs text-muted">{r.next}</dd>
          </div>
        ))}
      </dl>
      <div className="px-5 pb-5 pt-4 sm:px-6">
        <p className="text-xs text-muted">Overall score history</p>
        <p className="sr-only">Overall score history, May to October: {HISTORY.map((h) => `${h.m} ${h.v}`).join(", ")}. Question list updated in July.</p>
        <ol aria-hidden className="mt-3 grid h-28 grid-cols-6 items-end gap-2">
          {HISTORY.map((h, i) => (
            <li key={h.m} className="relative flex h-full flex-col items-center justify-end gap-1.5">
              {h.method && <span className="absolute inset-y-0 -left-1 border-l border-dashed border-border-strong" />}
              <span className="text-[11px] tabular-nums text-fg-soft">{h.v}</span>
              <span
                className={clsx("w-full rounded-t-md", i === HISTORY.length - 1 ? "bg-primary" : "bg-primary/25")}
                style={{ height: `${(h.v - 30) * 1.8}%` }}
              />
              <span className={clsx("text-[11px]", i === HISTORY.length - 1 ? "font-semibold text-fg" : "text-muted")}>{h.m}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span aria-hidden className="h-3 w-0 border-l border-dashed border-border-strong" />
          Question list changed in July, so that month is flagged
        </p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ work you can see */

const LOG: { date: string; title: string; who: Who; note?: string; undo?: boolean }[] = [
  { date: "21 Oct", title: "Meta description updated on the custom-cakes page", who: "Automated", note: "Approved by you", undo: true },
  { date: "17 Oct", title: "Opening hours fixed on Google Business Profile", who: "You", note: "Done by hand, marked done" },
  { date: "14 Oct", title: "Delivery areas answered on the homepage", who: "Automated", note: "Approved by you", undo: true },
  { date: "9 Oct", title: "“Eggless cakes” page refreshed", who: "Our team" },
];

export function WorkLogVignette() {
  return (
    <Panel title="Work log" sub={`October · ${DOMAIN}`} className="shadow-xl">
      <dl className="grid grid-cols-3 border-b border-border">
        {(
          [
            { who: "Our team", n: 6 },
            { who: "You", n: 3 },
            { who: "Automated", n: 4 },
          ] as { who: Who; n: number }[]
        ).map((c, i) => (
          <div key={c.who} className={clsx("px-4 py-4 sm:px-6", i > 0 && "border-l border-border")}>
            <dt className="text-xs text-muted">{c.who}</dt>
            <dd className="mt-1 text-[1.75rem] font-semibold leading-none tracking-[-0.035em] tabular-nums text-fg">{c.n}</dd>
          </div>
        ))}
      </dl>
      <ol className="px-5 sm:px-6">
        {LOG.map((l) => (
          <li key={l.title} className="grid grid-cols-[3.25rem_1fr] items-start gap-3 border-b border-border py-3.5 last:border-0">
            <span className="pt-0.5 text-xs tabular-nums text-muted">{l.date}</span>
            <span className="flex min-w-0 items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-small font-medium leading-snug text-fg">{l.title}</span>
                {(l.note || l.undo) && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {l.note}
                    {l.undo && (
                      <span className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-4">
                        <RotateCcw aria-hidden size={12} />
                        Roll back
                      </span>
                    )}
                  </span>
                )}
              </span>
              <WhoChip who={l.who} />
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-muted sm:px-6">
        <RotateCcw aria-hidden size={13} className="shrink-0" />
        The page is saved before every change made through a connector, so it can be put back.
      </p>
    </Panel>
  );
}
