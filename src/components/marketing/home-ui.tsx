// Product UI compositions for the homepage. Built from the real ui primitives and tokens.
// Every business, number and answer shown here is sample data and labelled as such.
import clsx from "clsx";
import { Check, Link2, Minus, RotateCcw } from "lucide-react";
import { IssueCard, Meter, RiskBadge, ScoreRing } from "@/components/ui";
import { STRIP_ENGINES, inkPill } from "./ui";

/** Small, discreet "Sample" label for product UI. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      Sample
    </span>
  );
}

const PILLARS = [
  { label: "SEO", score: 78 },
  { label: "AEO", score: 54 },
  { label: "GEO", score: 41 },
  { label: "Brand", score: 86 },
] as const;

/** Hero: an AI answer card overlapping a compact report card. */
export function HeroComposition() {
  return (
    <figure aria-label="Sample: an AI answer that names a business, and its visibility report" className="relative">
      {/* AI answer */}
      <div className="relative z-10 rounded-[22px] border border-border bg-surface p-5 pb-12 shadow-xl sm:p-7 sm:pb-12 lg:mr-[16%] lg:pb-20">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-small font-medium text-fg">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            AI answer
          </p>
          <SampleTag />
        </div>
        <p className="mt-5 rounded-2xl rounded-tr-md bg-surface-2 px-4 py-3 text-[0.9375rem] leading-snug text-fg sm:ml-auto sm:max-w-[85%]">
          Where can I order an eggless birthday cake in Indiranagar today?
        </p>
        <p className="mt-5 text-[0.9375rem] leading-relaxed text-fg-soft">
          A good option is{" "}
          <mark className="rounded-md bg-primary-soft px-1 py-0.5 font-semibold text-primary-soft-fg">Greenleaf Bakery</mark>,
          which bakes eggless cakes to order and delivers the same day across Indiranagar and Domlur. Order before 2 pm
          for evening delivery.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Sources</span>
          {["greenleaf-bakery.example", "bangalore-eats.example"].map((s, i) => (
            <span
              key={s}
              className={clsx(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
                i === 0 ? "border-primary/30 bg-primary-soft text-primary-soft-fg" : "border-border text-fg-soft",
              )}
            >
              <Link2 aria-hidden size={12} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Report card */}
      <div className="relative z-20 -mt-6 ml-6 rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:ml-auto sm:w-[78%] sm:p-6 lg:-mt-14 lg:w-[62%]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Visibility report</p>
            <p className="truncate text-[0.9375rem] font-semibold text-fg">greenleaf-bakery.example</p>
          </div>
          <SampleTag />
        </div>
        <div className="mt-5 flex items-center gap-5">
          <ScoreRing score={65} size="md" label="Sample overall score" />
          <ul className="min-w-0 flex-1 space-y-2.5">
            {PILLARS.map((p) => (
              <li key={p.label} className="grid grid-cols-[3.25rem_1fr_1.75rem] items-center gap-2 text-xs">
                <span className="font-medium text-fg">{p.label}</span>
                <Meter value={p.score} max={100} label={`Sample ${p.label} score`} tone="score" size="sm" />
                <span className="text-right tabular-nums text-fg-soft">{p.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}

/** Full-bleed, slow marquee of the places people ask. Pure CSS. */
export function EngineStrip() {
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {STRIP_ENGINES.map((e) => (
        <li key={e} className="flex items-center whitespace-nowrap">
          <span className="px-6 text-[1.125rem] font-medium tracking-[-0.01em] text-muted sm:px-9 sm:text-[1.375rem]">{e}</span>
          <span aria-hidden className="size-1.5 rounded-full bg-border-strong" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Where your customers ask" className="overflow-hidden border-y border-border bg-surface-2/60 py-6 sm:py-7">
      <p className="sr-only">Where your customers ask questions: {STRIP_ENGINES.join(", ")}.</p>
      <div aria-hidden className="mk-marquee">
        {row()}
        {row(true)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ product tour */

const ENGINE_COLS = ["ChatGPT", "Gemini", "Perplexity", "AI Overviews"] as const;
type Cell = "cited" | "mentioned" | "none";
const ANSWERS: { q: string; cells: Cell[] }[] = [
  { q: "Eggless birthday cake near Indiranagar", cells: ["cited", "mentioned", "cited", "none"] },
  { q: "Best bakery for a custom wedding cake", cells: ["mentioned", "none", "none", "none"] },
  { q: "Same-day cake delivery in Bengaluru", cells: ["cited", "cited", "mentioned", "mentioned"] },
  { q: "Sugar-free cakes for diabetics", cells: ["none", "none", "none", "none"] },
];

function CellMark({ v }: { v: Cell }) {
  if (v === "cited")
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-fg">
        <Check aria-hidden size={15} strokeWidth={2.5} />
        <span className="sr-only">Mentioned and cited</span>
      </span>
    );
  if (v === "mentioned")
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full border-[1.5px] border-primary text-primary">
        <Check aria-hidden size={14} strokeWidth={2.5} />
        <span className="sr-only">Mentioned, not cited</span>
      </span>
    );
  return (
    <span className="inline-flex size-7 items-center justify-center text-border-strong">
      <Minus aria-hidden size={16} />
      <span className="sr-only">Not mentioned</span>
    </span>
  );
}

export function AnswersPanel() {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <p className="text-[0.9375rem] font-semibold text-fg">AI answers this month</p>
        <SampleTag />
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <caption className="sr-only">Sample: whether each AI engine mentioned or cited the business</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                Question people ask
              </th>
              {ENGINE_COLS.map((e) => (
                <th key={e} scope="col" className="px-2 py-3 text-center font-medium">
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ANSWERS.map((r) => (
              <tr key={r.q} className="border-b border-border last:border-0">
                <th scope="row" className="px-5 py-4 text-small font-medium text-fg sm:px-6">
                  {r.q}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-2 py-4 text-center">
                    <CellMark v={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-surface-2/60 px-5 py-3.5 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-2">
          <CellMark v="cited" /> Named and linked
        </span>
        <span className="inline-flex items-center gap-2">
          <CellMark v="mentioned" /> Named only
        </span>
        <span className="ml-auto tabular-nums">Based on 64 saved answers</span>
      </div>
    </div>
  );
}

export function FixPanel() {
  return (
    <div className="relative">
      <SampleTag className="absolute -top-3 right-6 z-10" />
      <IssueCard
        className="!rounded-[22px] !shadow-lg"
        title="AI can't find a clear answer to “Do you deliver?”"
        pillarLabel="AEO"
        impact="high"
        effort="quick"
        affectedCount={6}
        whatsWrong="Your delivery details sit in a footer note and a PDF menu. No page says plainly where and when you deliver."
        howToFix={[
          "Add a short “Delivery” answer to your home and contact pages.",
          "Name the areas, days and minimum order in one sentence.",
          "Mark it up as an FAQ. We can draft this for you to approve.",
        ]}
      />
    </div>
  );
}

export function ApprovalPanel() {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-fg">Homepage · meta description</p>
          <p className="text-xs text-muted">Drafted from the delivery fix</p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge riskClass="B" />
          <SampleTag />
        </div>
      </div>
      <div className="space-y-3 px-5 py-5 font-mono text-[0.8125rem] leading-relaxed sm:px-6">
        <p className="rounded-lg bg-diff-remove/60 px-3 py-2.5 text-fg">
          <span aria-hidden className="mr-2 select-none text-danger">−</span>
          <span className="sr-only">Removed: </span>
          Welcome to Greenleaf Bakery. Fresh cakes and more.
        </p>
        <p className="rounded-lg bg-diff-add/70 px-3 py-2.5 text-fg">
          <span aria-hidden className="mr-2 select-none text-success">+</span>
          <span className="sr-only">Added: </span>
          Eggless and custom cakes in Indiranagar, with same-day delivery across East Bengaluru. Order by 2 pm.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6">
        <span className={inkPill("md", false, "pointer-events-none")} aria-hidden>
          <Check />
          Approve
        </span>
        <span
          aria-hidden
          className="inline-flex h-10 items-center rounded-full border border-border-strong px-5 text-small font-medium text-fg"
        >
          Edit draft
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted sm:ml-auto">
          <RotateCcw aria-hidden size={13} />
          Snapshot saved for rollback
        </span>
      </div>
    </div>
  );
}
