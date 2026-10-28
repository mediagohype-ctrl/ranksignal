// Homepage sections added after the original design: the monthly impact report, work log, score history,
// automatic re-checks, share links and the done-for-you service. Same design language as home-ui.tsx.
// Every business, number and answer shown here is sample data and labelled as such.
import clsx from "clsx";
import Link from "next/link";
import { ArrowRight, Check, Download, Minus, Plus, RotateCcw } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { SampleTag } from "./home-ui";
import { inkPill } from "./ui";
import { SERVICE_FROM_PRICE, inr } from "./plans";

/* ------------------------------------------------------------------ sample data */

const PILLAR_DELTAS = [
  { label: "SEO", end: 78, delta: 4 },
  { label: "AEO", end: 54, delta: 9 },
  { label: "GEO", end: 41, delta: 6 },
  { label: "Brand", end: 86, delta: 1 },
] as const;

/** Overall score, May → October. `shipped` = fixes went live that month; `method` = question set changed. */
const HISTORY = [
  { m: "May", v: 44 },
  { m: "Jun", v: 47 },
  { m: "Jul", v: 51, method: true },
  { m: "Aug", v: 53, shipped: true },
  { m: "Sep", v: 58, shipped: true },
  { m: "Oct", v: 65, shipped: true },
];

const WON = ["Eggless birthday cake near Indiranagar", "Same-day cake delivery in Bengaluru"];
const LOST = "Best bakery for a custom wedding cake";

type Who = "Our team" | "You" | "Automated";
const WORK: { title: string; who: Who; note?: string; undo?: boolean }[] = [
  { title: "FAQ markup added to the custom-cakes page", who: "Automated", note: "Approved by you", undo: true },
  { title: "Delivery areas answered on the homepage", who: "Our team" },
  { title: "Opening hours fixed on Google Business Profile", who: "You", note: "Marked done by hand" },
];

/* ------------------------------------------------------------------ sparkline */

function ScoreSparkline() {
  const W = 300;
  const H = 96;
  const padX = 12;
  const top = 10;
  const bottom = 70;
  const min = 40;
  const max = 70;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (HISTORY.length - 1);
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const line = HISTORY.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(HISTORY.length - 1).toFixed(1)} ${bottom} L${x(0).toFixed(1)} ${bottom} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <line x1={padX} x2={W - padX} y1={bottom} y2={bottom} className="stroke-border" strokeWidth={1} />
      {HISTORY.map((p, i) =>
        p.method ? (
          <line key={`m${i}`} x1={x(i)} x2={x(i)} y1={top - 6} y2={bottom} className="stroke-border-strong" strokeWidth={1} strokeDasharray="3 3" />
        ) : null,
      )}
      <path d={area} className="fill-primary/[0.07]" />
      <path d={line} fill="none" className="stroke-primary" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      {HISTORY.map((p, i) =>
        p.shipped ? (
          <circle key={`s${i}`} cx={x(i)} cy={y(p.v)} r={i === HISTORY.length - 1 ? 4.5 : 3.5} className="fill-surface stroke-primary" strokeWidth={2} />
        ) : null,
      )}
      {HISTORY.map((p, i) => (
        <text
          key={p.m}
          x={x(i)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === HISTORY.length - 1 ? "end" : "middle"}
          className={i === HISTORY.length - 1 ? "fill-fg" : "fill-muted"}
          fontSize={10.5}
          fontWeight={i === HISTORY.length - 1 ? 600 : 400}
        >
          {p.m}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ composition */

const WHO_STYLE: Record<Who, string> = {
  "Our team": "bg-fg text-bg",
  You: "border border-border-strong text-fg",
  Automated: "bg-primary-soft text-primary-soft-fg",
};

/** A monthly impact report card overlapped by a week of the client work log. */
export function MonthlyProofComposition() {
  return (
    <figure aria-label="Sample: a monthly impact report and a week of the work log for a fictional bakery" className="relative">
      {/* Monthly report */}
      <div className="relative z-10 overflow-hidden rounded-[22px] border border-border bg-surface shadow-xl lg:mr-[10%]">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold text-fg">October impact report</p>
            <p className="truncate text-xs text-muted">Emailed 1 Nov · greenleaf-bakery.example</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="hidden h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-fg-soft sm:inline-flex"
            >
              <Download size={13} />
              PDF
            </span>
            <SampleTag />
          </div>
        </div>

        {/* Score then → now + history */}
        <div className="grid gap-6 px-5 pt-5 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-8 sm:px-6">
          <div>
            <p className="text-xs text-muted">Overall score, since last month</p>
            <p className="mt-2 flex items-baseline gap-2.5">
              <span className="text-[1.375rem] font-medium leading-none tabular-nums text-muted">58</span>
              <ArrowRight aria-hidden size={16} className="self-center text-muted" />
              <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">65</span>
              <span className="inline-flex h-7 items-center self-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
                +7
              </span>
            </p>
            <p className="sr-only">Score history, May to October: {HISTORY.map((h) => `${h.m} ${h.v}`).join(", ")}.</p>
          </div>
          <div className="min-w-0">
            <ScoreSparkline />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-4 pt-1 text-[11px] text-muted sm:justify-end sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-primary bg-surface" />
            Fixes went live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0 border-l border-dashed border-border-strong" />
            Questions updated
          </span>
        </div>

        {/* Pillar deltas */}
        <dl className="grid grid-cols-4 border-y border-border">
          {PILLAR_DELTAS.map((p, i) => (
            <div key={p.label} className={clsx("px-3 py-3.5 sm:px-6", i > 0 && "border-l border-border")}>
              <dt className="text-xs text-muted">{p.label}</dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[1.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg">{p.end}</span>
                <span className="text-xs font-semibold tabular-nums text-success">+{p.delta}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* Questions won / lost + wrong answer */}
        <div className="px-5 pb-20 pt-5 sm:px-6 sm:pb-24">
          <p className="text-small font-semibold text-fg">AI questions, same 50 as September</p>
          <ul className="mt-3">
            {WON.map((q) => (
              <li key={q} className="flex items-start gap-2.5 border-b border-border py-2.5 text-small leading-snug text-fg-soft">
                <span aria-hidden className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Plus size={12} strokeWidth={2.75} />
                </span>
                <span>
                  <span className="sr-only">Won: </span>
                  {q}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2.5 border-b border-border py-2.5 text-small leading-snug text-fg-soft">
              <span aria-hidden className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                <Minus size={12} strokeWidth={2.75} />
              </span>
              <span>
                <span className="sr-only">Lost: </span>
                {LOST} <span className="text-muted">· now names Crumb &amp; Co.</span>
              </span>
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-fg-soft">
            <span className="font-semibold text-fg">Wrong answer caught:</span> Gemini says you close at 6 pm. Your site says 9 pm.
          </p>
        </div>
      </div>

      {/* Work log */}
      <div className="relative z-20 -mt-10 ml-4 rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:-mt-12 sm:ml-auto sm:w-[80%] sm:p-6 lg:w-[66%]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Work log</p>
            <p className="text-[0.9375rem] font-semibold text-fg">Week of 20 October</p>
          </div>
          <SampleTag />
        </div>
        <ol className="mt-3">
          {WORK.map((w) => (
            <li key={w.title} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0">
              <span className="min-w-0">
                <span className="block text-small font-medium leading-snug text-fg">{w.title}</span>
                {(w.note || w.undo) && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {w.note}
                    {w.undo && (
                      <span className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-4">
                        <RotateCcw aria-hidden size={12} />
                        Roll back
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span className={clsx("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium", WHO_STYLE[w.who])}>
                {w.who}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ section: proof every month */

const ALWAYS_ON = [
  {
    title: "Re-checked on its own",
    body: "By default we re-read your site every week and ask AI your questions every month, then email you when the new report is ready.",
  },
  {
    title: "History that compares fairly",
    body: "Every score is kept over time. “Since last month” compares the same questions, and the chart marks when fixes went live.",
  },
  {
    title: "A link you can share",
    body: "Send a read-only report to your team or a client. No login needed, and you can switch the link off at any time.",
  },
];

export function MonthlyProofSection() {
  return (
    <section id="monthly-report" aria-labelledby="proof-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-32">
      <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-0">
        <div className="mk-reveal min-w-0 lg:col-span-5 lg:row-start-1">
          <h2 id="proof-title" className="mk-statement max-w-[11ch] text-fg">
            See what changed. Every month.
          </h2>
          <p className="mk-lead mt-8 max-w-[34rem] text-fg-soft">
            Early each month, a short report lands in your inbox, with a PDF to pass on: your scores then and now, the AI
            questions you won and lost, anything AI got wrong about you, and every fix that went live.
          </p>
          <p className="mk-body mt-5 max-w-[34rem] text-fg-soft">
            Every change is logged with who made it, and automated ones roll back in one click. The report shows what
            we measured next to the work done. It doesn&apos;t claim one caused the other.
          </p>
        </div>
        <ul className="mk-reveal max-w-[34rem] border-t border-fg max-lg:order-last lg:col-span-5 lg:row-start-2 lg:mt-12 lg:self-start">
          {ALWAYS_ON.map((a) => (
            <li key={a.title} className="border-b border-border py-5">
              <h3 className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-fg">{a.title}</h3>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-fg-soft">{a.body}</p>
            </li>
          ))}
        </ul>
        <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:pt-4">
          <MonthlyProofComposition />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ section: DIY or done for you */

const DONE_FOR_YOU = [
  "Our team ships the fixes on your site each month, after you approve them",
  "Google Business Profile and key pages kept up to date",
  "A monthly impact report we check by hand, and a call to walk you through it",
];

export function DoneForYouSection() {
  return (
    <section aria-labelledby="dfy-title" className="pb-24 sm:pb-32">
      <div className="container-marketing">
        <div className="grid gap-12 border-t border-border pt-16 sm:pt-20 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="mk-reveal min-w-0 lg:col-span-5">
            <h2 id="dfy-title" className="mk-title max-w-[14ch] text-fg">
              Do it yourself, or let us do it.
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              {BRAND.name} on its own gives you the scores, the fix list and drafted changes to approve. If you&apos;d
              rather not do the work yourself, our team can do it for you.
            </p>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6">
            <div className="rounded-[28px] bg-fg p-8 text-bg sm:p-12">
              <p className="text-small font-medium text-bg/70">Done for you</p>
              <p className="mt-3 text-[clamp(2rem,1.6rem+1.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-bg">
                From <span className="tabular-nums">{inr(SERVICE_FROM_PRICE)}</span> a month.
              </p>
              <ul className="mt-9 space-y-5">
                {DONE_FOR_YOU.map((d) => (
                  <li key={d} className="mk-body flex gap-4 text-bg/85">
                    <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-bg/15">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/services" className={inkPill("lg", true)}>
                  See done-for-you plans
                  <ArrowRight aria-hidden />
                </Link>
                <p className="text-small text-bg/65 sm:max-w-[16rem] sm:text-right">
                  Plus GST and setup. We promise the work, not rankings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
