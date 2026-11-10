// The whole MyWebRank cycle as one visual journey (used on /how-it-works).
// Server component. Every word is real HTML text; the small illustrations are aria-hidden and the
// step text next to each one says the same thing in words. Sample numbers are for a fictional bakery.
import clsx from "clsx";
import { ArrowRight, Check, Globe, Plus, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import { SampleTag } from "../home-ui";

const DOMAIN = "greenleaf-bakery.example";

type Who = "You" | "We";

const JOURNEY: { title: string; body: string; who: Who; art: React.ReactNode }[] = [
  {
    title: "Add your website",
    body: "Type your address, country and the competitors you want to compare with.",
    who: "You",
    art: <AddSiteArt />,
  },
  {
    title: "We check your site and ask AI",
    body: "We read your pages and ask AI assistants your customer questions.",
    who: "We",
    art: <CheckArt />,
  },
  {
    title: "You get a to-do list",
    body: "Fixes in order, most useful first, each explained in plain words.",
    who: "We",
    art: <TodoArt />,
  },
  {
    title: "You approve",
    body: "Nothing goes live until you say OK to the exact change.",
    who: "You",
    art: <ApproveArt />,
  },
  {
    title: "We publish, with undo",
    body: "We save the page first, so any change can be undone in one click.",
    who: "We",
    art: <PublishArt />,
  },
  {
    title: "Every month: check again and report",
    body: "We check again and show what changed, without claiming the fix caused it.",
    who: "We",
    art: <ReportArt />,
  },
];

/** Six-step journey: add website → check + ask AI → to-do list → approve → publish with undo → monthly re-check. */
export function JourneyFlow({ className }: { className?: string }) {
  return (
    <figure className={clsx("min-w-0", className)}>
      <ol className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-5">
        {JOURNEY.map((s, i) => (
          <li key={s.title} className="mk-reveal relative flex min-w-0 flex-col rounded-[22px] border border-border bg-surface p-4">
            <div aria-hidden className="relative h-28 overflow-hidden rounded-2xl bg-surface-2/70">
              {s.art}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-small font-medium tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
              <span
                className={clsx(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium",
                  s.who === "You" ? "border border-border-strong text-fg" : "bg-fg text-bg",
                )}
              >
                <span className="sr-only">Who: </span>
                {s.who === "You" ? "You" : "We do it"}
              </span>
            </div>
            <p className="mt-2 text-[1rem] font-semibold leading-snug tracking-[-0.015em] text-fg">{s.title}</p>
            <p className="mt-1.5 text-small leading-relaxed text-fg-soft">{s.body}</p>
            {i < JOURNEY.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-[22px] top-15 z-10 hidden size-6 items-center justify-center rounded-full border border-border bg-surface text-muted lg:inline-flex"
              >
                <ArrowRight size={13} />
              </span>
            )}
          </li>
        ))}
      </ol>
      {/* The loop back: from step 6 to step 2, every month. */}
      <div aria-hidden className="relative hidden h-10 lg:block">
        <div className="absolute inset-y-0 left-[25%] right-[8.33%] rounded-b-[18px] border-2 border-t-0 border-dashed border-border-strong" />
      </div>
      <figcaption className="mt-5 flex flex-wrap items-center justify-between gap-3 lg:mt-3">
        <span className="inline-flex items-center gap-2 text-small text-fg-soft">
          <RotateCw aria-hidden size={15} className="shrink-0 text-primary" />
          The cycle from adding your website to the monthly report. After step 6 it goes back to step 2, every month.
        </span>
        <SampleTag />
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ illustrations (aria-hidden) */

function AddSiteArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-3">
      <div className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5">
        <Globe size={12} className="shrink-0 text-muted" />
        <span className="truncate text-[10px] text-fg-soft">{DOMAIN}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-5 flex-1 rounded-full border border-dashed border-border-strong" />
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2 text-[10px] font-semibold text-primary-fg">
          <Plus size={10} strokeWidth={3} />
          Add
        </span>
      </div>
    </div>
  );
}

function CheckArt() {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex h-full items-center gap-2.5 px-3">
      <svg viewBox="0 0 44 44" className="size-12 shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-score-track" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - 0.58)}
          className="stroke-score-ok"
        />
        <text x="22" y="22" transform="rotate(90 22 22)" textAnchor="middle" dominantBaseline="central" className="fill-fg text-[11px] font-semibold">
          58
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="block rounded-xl rounded-bl-sm border border-border bg-surface px-2 py-1 text-[10px] leading-tight text-fg-soft">
          Best eggless cakes near me?
        </span>
        <span className="flex items-center gap-1 rounded-xl rounded-br-sm bg-primary-soft px-2 py-1 text-[10px] leading-tight text-primary-soft-fg">
          <Sparkles size={10} className="shrink-0" />
          <span className="truncate">AI answer saved</span>
        </span>
      </div>
    </div>
  );
}

function TodoArt() {
  const rows = [
    { w: "w-[80%]", tone: "bg-score-poor" },
    { w: "w-[62%]", tone: "bg-score-ok" },
    { w: "w-[48%]", tone: "bg-score-good" },
  ];
  return (
    <ul className="flex h-full flex-col justify-center gap-2 px-3">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-muted">{i + 1}</span>
          <span className={clsx("h-1.5 rounded-full bg-border-strong", r.w)} />
          <span className={clsx("ml-auto size-2 shrink-0 rounded-full", r.tone)} />
        </li>
      ))}
    </ul>
  );
}

function ApproveArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-3">
      <span className="flex h-4 items-center gap-1.5 rounded bg-danger-soft px-1.5">
        <span className="text-[9px] font-bold text-danger">−</span>
        <span className="h-1 w-[60%] rounded-full bg-danger/40" />
      </span>
      <span className="flex h-4 items-center gap-1.5 rounded bg-success-soft px-1.5">
        <span className="text-[9px] font-bold text-success">+</span>
        <span className="h-1 w-[75%] rounded-full bg-success/50" />
      </span>
      <span className="mt-1.5 inline-flex h-7 items-center justify-center gap-1 self-end rounded-full bg-fg px-3 text-[10px] font-semibold text-bg">
        <Check size={11} strokeWidth={3} />
        Approve
      </span>
    </div>
  );
}

function PublishArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-fg">
          <span className="size-2 rounded-full bg-success" />
          Live
        </span>
        <span className="text-[10px] text-muted">Page saved</span>
      </div>
      <span className="inline-flex h-7 items-center gap-1 self-start rounded-full border border-border-strong bg-surface px-2.5 text-[10px] font-medium text-fg">
        <RotateCcw size={11} />
        Undo
      </span>
    </div>
  );
}

function ReportArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-3">
      {[
        { label: "Before", v: 58, cls: "bg-border-strong" },
        { label: "After", v: 65, cls: "bg-primary" },
      ].map((b) => (
        <div key={b.label} className="grid grid-cols-[2.6rem_1fr_1.25rem] items-center gap-1.5">
          <span className="text-[10px] text-muted">{b.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-score-track">
            <span className={clsx("block h-full rounded-full", b.cls)} style={{ width: `${b.v}%` }} />
          </span>
          <span className="text-right text-[10px] font-semibold tabular-nums text-fg">{b.v}</span>
        </div>
      ))}
      <span className="mt-0.5 self-start rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">+7 since last month</span>
    </div>
  );
}
