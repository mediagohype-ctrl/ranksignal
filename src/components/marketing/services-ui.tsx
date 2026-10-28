// Done-for-you service: tier cards, hero delivery log and the sample monthly impact report.
// Every business, number and fix shown here is sample data and labelled as such.
import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { SampleTag } from "./home-ui";
import { inkPill } from "./ui";
import { SERVICE_TIERS, inr, servicesContactHref, type ServiceTier } from "./plans";

/* ------------------------------------------------------------------ tier cards */

export function ServiceTierCards({ headingLevel = "h3", className }: { headingLevel?: "h2" | "h3"; className?: string }) {
  return (
    <ul className={clsx("grid gap-6 lg:grid-cols-3 lg:items-stretch", className)}>
      {SERVICE_TIERS.map((t) => (
        <TierCard key={t.id} tier={t} Heading={headingLevel} />
      ))}
    </ul>
  );
}

function TierCard({ tier: t, Heading }: { tier: ServiceTier; Heading: "h2" | "h3" }) {
  const ink = !!t.featured;
  return (
    <li
      className={clsx(
        "mk-reveal relative flex flex-col rounded-[28px] p-7 sm:p-9",
        ink ? "bg-fg text-bg" : "border border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <Heading className={clsx("text-[1.75rem] font-semibold leading-none tracking-[-0.03em]", ink ? "text-bg" : "text-fg")}>
          {t.name}
        </Heading>
        {ink && (
          <span className="inline-flex h-7 items-center rounded-full bg-bg px-3 text-xs font-semibold text-fg">Recommended</span>
        )}
      </div>
      <p className={clsx("mt-4 text-[1rem] leading-relaxed lg:min-h-[4.9em]", ink ? "text-bg/80" : "text-fg-soft")}>{t.blurb}</p>

      <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
        <span
          className={clsx(
            "text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums",
            ink ? "text-bg" : "text-fg",
          )}
        >
          {inr(t.price)}
        </span>
        <span className={clsx("text-small", ink ? "text-bg/75" : "text-muted")}>a month</span>
      </p>
      <dl className={clsx("mt-4 space-y-1 text-small", ink ? "text-bg/80" : "text-fg-soft")}>
        <div className="flex gap-1.5">
          <dt className="sr-only">Setup fee</dt>
          <dd>
            + <span className="tabular-nums">{inr(t.setup)}</span> one-time setup
          </dd>
        </div>
        <div>
          <dt className="sr-only">Minimum term</dt>
          <dd>
            {t.minimumMonths}-month minimum{t.termNote ? <span className={ink ? "text-bg/70" : "text-muted"}> · {t.termNote}</span> : null}
          </dd>
        </div>
      </dl>

      <Link href={servicesContactHref(t.id)} className={inkPill("lg", ink, "mt-8 w-full")}>
        Book a free strategy call
        <ArrowRight aria-hidden />
      </Link>

      <div className={clsx("mt-9 flex-1 border-t pt-7", ink ? "border-bg/20" : "border-border")}>
        {t.inherits && <p className={clsx("mb-4 text-small font-semibold", ink ? "text-bg" : "text-fg")}>{t.inherits}</p>}
        <ul className="space-y-3.5">
          {t.includes.map((i) => (
            <li key={i} className={clsx("flex gap-3 text-[0.9375rem] leading-snug", ink ? "text-bg/85" : "text-fg-soft")}>
              <span
                aria-hidden
                className={clsx(
                  "mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                  ink ? "bg-bg/15 text-bg" : "bg-primary-soft text-primary-soft-fg",
                )}
              >
                <Check size={12} strokeWidth={2.75} />
              </span>
              {i}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ hero: delivery log */

const LOG = [
  { date: "3 Oct", title: "Delivery areas answered on the homepage", tag: "Page" },
  { date: "7 Oct", title: "Google Business Profile: hours, services, 12 photos", tag: "Profile" },
  { date: "14 Oct", title: "FAQ markup on the custom-cakes page", tag: "Schema" },
  { date: "21 Oct", title: "“Eggless cakes” page refreshed", tag: "Refresh" },
];

export function DeliveryComposition() {
  return (
    <figure aria-label="Sample: a month of shipped fixes and the change it measured" className="relative">
      <div className="relative z-10 rounded-[22px] border border-border bg-surface shadow-xl lg:mr-[14%]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold text-fg">Shipped this month</p>
            <p className="text-xs text-muted">October · greenleaf-bakery.example</p>
          </div>
          <SampleTag />
        </div>
        <div className="px-5 pt-5 sm:px-6">
          <div className="flex items-baseline justify-between gap-3 text-small">
            <span className="font-medium text-fg">Fixes delivered</span>
            <span className="tabular-nums text-fg-soft">
              <span className="font-semibold text-fg">15</span> of 15 agreed
            </span>
          </div>
          <div aria-hidden className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-score-track">
            <div className="h-full w-full rounded-full bg-primary" />
          </div>
        </div>
        <ol className="mt-3 px-5 pb-16 sm:px-6 lg:pb-20">
          {LOG.map((l) => (
            <li key={l.title} className="grid grid-cols-[3.25rem_1fr] items-start gap-3 border-b border-border py-3.5 last:border-0">
              <span className="pt-0.5 text-xs tabular-nums text-muted">{l.date}</span>
              <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="text-small font-medium leading-snug text-fg">{l.title}</span>
                <span className="hidden h-6 shrink-0 items-center rounded-full border border-border px-2.5 text-[11px] font-medium text-fg-soft sm:inline-flex">
                  {l.tag}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative z-20 -mt-10 ml-6 rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:ml-auto sm:w-[70%] sm:p-6 lg:-mt-16 lg:w-[56%]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">AI mention rate, 50 questions</p>
          <SampleTag />
        </div>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">31%</span>
          <span className="inline-flex h-7 items-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
            +9 pts
          </span>
        </p>
        <p className="mt-2 text-xs text-muted">vs 22% in September · from 400 saved answers</p>
        <p className="mt-4 inline-flex items-center gap-1.5 border-t border-border pt-3 text-xs text-fg-soft">
          <RotateCcw aria-hidden size={13} />
          Every change logged, one click to roll back
        </p>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ sample monthly impact report */

const KPIS = [
  { label: "Fixes shipped", value: "15/15", change: "All agreed fixes", good: true },
  { label: "AI mention rate", value: "31%", change: "+9 pts", good: true },
  { label: "Questions where you’re linked", value: "12", change: "+5 of 50", good: true },
  { label: "Overall score", value: "68", change: "+7", good: true },
];

const ENGINES = [
  { name: "ChatGPT", before: 26, after: 38 },
  { name: "Perplexity", before: 29, after: 41 },
  { name: "Gemini", before: 24, after: 30 },
  { name: "Copilot", before: 13, after: 24 },
  { name: "AI Overviews", before: 18, after: 22 },
];

const SHIPPED = [
  { title: "Answered “Do you deliver to Domlur?” on 3 pages", tag: "Answer" },
  { title: "Google Business Profile: services and hours fixed", tag: "Profile" },
  { title: "Bakery and FAQ schema added to 6 pages", tag: "Schema" },
  { title: "“Custom wedding cakes” page rewritten", tag: "Refresh" },
];

const NEXT = [
  "Sugar-free range page (no AI tool names you here yet)",
  "Fix the wrong opening hours Gemini quotes",
  "Refresh the corporate orders page",
];

export function ImpactReportSample() {
  return (
    <figure
      aria-label="Sample monthly impact report for a fictional bakery"
      className="relative overflow-hidden rounded-[28px] border border-border bg-surface shadow-xl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-6 sm:px-9 sm:py-7">
        <div className="min-w-0">
          <p className="mk-label">Monthly impact report</p>
          <p className="mt-2 text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-fg">
            Greenleaf Bakery · October 2026
          </p>
          <p className="mt-1 text-xs text-muted">Fix plan · prepared 3 November · compared with September</p>
        </div>
        <SampleTag />
      </div>

      {/* Summary */}
      <p className="border-b border-border px-6 py-6 text-[1.0625rem] leading-relaxed text-fg sm:px-9">
        We shipped all 15 fixes we agreed for October. Across your 50 questions, AI assistants now name you in{" "}
        <strong className="font-semibold">31% of answers</strong>, up from 22%. The biggest gain came after we answered
        delivery areas on your homepage.
      </p>

      {/* KPIs */}
      <dl className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="bg-surface px-6 py-5 sm:px-7">
            <dt className="text-xs leading-snug text-muted">{k.label}</dt>
            <dd className="mt-2">
              <span className="block text-[1.875rem] font-semibold leading-none tracking-[-0.035em] tabular-nums text-fg">
                {k.value}
              </span>
              <span className="mt-2 inline-flex text-xs font-semibold text-success">{k.change}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid lg:grid-cols-2">
        {/* By engine */}
        <div className="border-b border-border px-6 py-6 sm:px-9 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="text-small font-semibold text-fg">Mention rate by AI engine</p>
            <span className="flex items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-3 rounded-full bg-border-strong" />
                Sep
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-3 rounded-full bg-primary" />
                Oct
              </span>
            </span>
          </div>
          <ul className="mt-5 space-y-4">
            {ENGINES.map((e) => (
              <li key={e.name} className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-3 text-xs">
                <span className="font-medium text-fg">{e.name}</span>
                <span aria-hidden className="space-y-1">
                  <span className="block h-1.5 rounded-full bg-border-strong" style={{ width: `${e.before * 2}%` }} />
                  <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${e.after * 2}%` }} />
                </span>
                <span className="text-right tabular-nums text-fg-soft">
                  <span className="sr-only">
                    {e.before}% in September, now{" "}
                  </span>
                  {e.after}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Shipped */}
        <div className="px-6 py-6 sm:px-9">
          <p className="text-small font-semibold text-fg">What we shipped</p>
          <ul className="mt-3">
            {SHIPPED.map((s) => (
              <li key={s.title} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0">
                <span className="flex gap-2.5 text-small leading-snug text-fg-soft">
                  <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-success" />
                  {s.title}
                </span>
                <span className="hidden h-6 shrink-0 items-center rounded-full border border-border px-2.5 text-[11px] font-medium text-fg-soft sm:inline-flex">
                  {s.tag}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">+ 11 more in the full change log</p>
        </div>
      </div>

      {/* Next month + method */}
      <div className="grid gap-6 border-t border-border bg-surface-2/60 px-6 py-6 sm:px-9 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-small font-semibold text-fg">Planned for November</p>
          <ol className="mt-3 space-y-2">
            {NEXT.map((n, i) => (
              <li key={n} className="flex gap-3 text-small leading-snug text-fg-soft">
                <span className="w-4 shrink-0 tabular-nums text-muted">{i + 1}.</span>
                {n}
              </li>
            ))}
          </ol>
        </div>
        <p className="self-end text-xs leading-relaxed text-muted lg:text-right">
          Based on 400 saved answers (50 questions, 5 engines, asked twice). Likely range ±4 pts. AI answers change from
          day to day; no ranking or mention is guaranteed.
        </p>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ closing CTA */

export function ServicesCta({
  title,
  body,
  primary,
  secondary,
  footnote,
}: {
  title: string;
  body: ReactNode;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  footnote?: ReactNode;
}) {
  return (
    <section aria-labelledby="final-cta" className="bg-fg text-bg">
      <div className="container-marketing grid gap-10 py-20 sm:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h2 id="final-cta" className="mk-statement max-w-[15ch] text-balance text-bg">
            {title}
          </h2>
          <div className="mk-lead mt-6 max-w-xl text-bg/75">{body}</div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
          <Link href={primary.href} className={inkPill("lg", true)}>
            {primary.label}
            <ArrowRight aria-hidden />
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[1rem] font-medium text-bg ring-1 ring-bg/30 hover:bg-bg/10"
          >
            {secondary.label}
            <ArrowUpRight aria-hidden size={18} />
          </Link>
        </div>
        {footnote && <p className="text-small text-bg/65 lg:col-span-12">{footnote}</p>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ list (homepage style) */

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-fg">
      {items.map((f) => (
        <details key={f.q} className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
            <h3 className="text-[1.125rem] font-medium leading-snug tracking-[-0.015em] text-fg sm:text-[1.25rem]">{f.q}</h3>
            <span
              aria-hidden
              className="relative mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-fg transition-transform duration-200 group-open:rotate-45"
            >
              <span className="absolute h-px w-3 bg-current" />
              <span className="absolute h-3 w-px bg-current" />
            </span>
          </summary>
          <p className="mk-body max-w-2xl pb-7 text-fg-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
