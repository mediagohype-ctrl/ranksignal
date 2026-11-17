// Done-for-you service: the "Do it for me" offer card (+ Custom), hero delivery log and the example monthly report.
// Every business, number and fix shown here is sample data and labelled as such.
import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { bookCallHref } from "@/lib/brand";
import { SampleTag } from "./home-ui";
import { inkPill } from "./ui";
import {
  CUSTOM_CONTACT_HREF, CUSTOM_PLAN, SERVICE_TIERS, gstOn, inr, servicesContactHref, newTabProps, type ServiceTier,
} from "./plans";

/* ------------------------------------------------------------------ offer cards */

/** The done-for-you offer card ("Do it for me"), optionally beside the Custom card. */
export function ServiceTierCards({
  headingLevel = "h3",
  className,
  withCustom = false,
}: {
  headingLevel?: "h2" | "h3";
  className?: string;
  withCustom?: boolean;
}) {
  return (
    <ul className={clsx("grid gap-6 lg:items-stretch", withCustom ? "lg:grid-cols-2" : "max-w-xl", className)}>
      {SERVICE_TIERS.map((t) => (
        <TierCard key={t.id} tier={t} Heading={headingLevel} />
      ))}
      {withCustom && <CustomCard Heading={headingLevel} />}
    </ul>
  );
}

function CheckList({ items, ink }: { items: readonly string[]; ink: boolean }) {
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
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
  );
}

function TierCard({ tier: t, Heading }: { tier: ServiceTier; Heading: "h2" | "h3" }) {
  const ink = !!t.featured;
  // The calendar when one is set (new tab); until then the contact page with this offer pre-filled.
  const callHref = bookCallHref(servicesContactHref(t.id));
  return (
    <li
      className={clsx(
        "mk-reveal relative flex flex-col rounded-[28px] p-7 sm:p-9",
        ink ? "bg-fg text-bg" : "border border-border bg-surface",
      )}
    >
      <Heading className={clsx("text-[1.75rem] font-semibold leading-none tracking-[-0.03em]", ink ? "text-bg" : "text-fg")}>
        {t.name}
      </Heading>
      <p className={clsx("mt-4 text-[1rem] leading-relaxed", ink ? "text-bg/80" : "text-fg-soft")}>{t.blurb}</p>

      <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
        <span
          className={clsx(
            "text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums",
            ink ? "text-bg" : "text-fg",
          )}
        >
          {inr(t.price)}
        </span>
        <span className={clsx("text-small", ink ? "text-bg/75" : "text-muted")}>a month{gstOn() ? " + GST" : ""}</span>
      </p>
      <dl className={clsx("mt-4 space-y-1 text-small", ink ? "text-bg/80" : "text-fg-soft")}>
        <div>
          <dt className="sr-only">Setup fee</dt>
          <dd>{t.setup > 0 ? `+ ${inr(t.setup)} one-time setup` : "No setup fee"}</dd>
        </div>
        <div>
          <dt className="sr-only">Term</dt>
          <dd>{t.termNote ?? `${t.minimumMonths}-month minimum`}</dd>
        </div>
      </dl>

      <Link href={callHref} {...newTabProps(callHref)} className={inkPill("lg", ink, "mt-8 w-full")}>
        Book a free call
        <ArrowRight aria-hidden />
      </Link>

      <div className={clsx("mt-9 flex-1 border-t pt-7", ink ? "border-bg/20" : "border-border")}>
        {t.inherits && <p className={clsx("mb-4 text-small font-semibold", ink ? "text-bg" : "text-fg")}>{t.inherits}</p>}
        <CheckList items={t.includes} ink={ink} />
      </div>
    </li>
  );
}

function CustomCard({ Heading }: { Heading: "h2" | "h3" }) {
  return (
    <li className="mk-reveal relative flex flex-col rounded-[28px] border border-border bg-surface p-7 sm:p-9">
      <Heading className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-fg">{CUSTOM_PLAN.name}</Heading>
      <p className="mt-4 text-[1rem] leading-relaxed text-fg-soft">{CUSTOM_PLAN.blurb}</p>
      <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] text-fg">
          {CUSTOM_PLAN.priceLabel}
        </span>
      </p>
      <p className="mt-4 text-small text-fg-soft">{CUSTOM_PLAN.start}</p>
      <Link href={CUSTOM_CONTACT_HREF} {...newTabProps(CUSTOM_CONTACT_HREF)} className={inkPill("lg", false, "mt-8 w-full")}>
        {CUSTOM_PLAN.cta}
        <ArrowRight aria-hidden />
      </Link>
      <div className="mt-9 flex-1 border-t border-border pt-7">
        <CheckList items={CUSTOM_PLAN.includes} ink={false} />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ hero: delivery log */

const LOG = [
  { date: "3 Oct", title: "Delivery areas answered on the homepage", tag: "Page" },
  { date: "7 Oct", title: "Google Business Profile: hours, services, 12 photos", tag: "Profile" },
  { date: "14 Oct", title: "Questions and answers added to the custom-cakes page", tag: "Info for AI" },
  { date: "21 Oct", title: "“Eggless cakes” page refreshed", tag: "Refresh" },
];

export function DeliveryComposition() {
  return (
    <figure aria-label="Sample: a month of fixes and the change we measured" className="relative">
      <div className="relative z-10 rounded-[22px] border border-border bg-surface shadow-xl lg:mr-[14%]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold text-fg">Fixes this month</p>
            <p className="text-xs text-muted">October · greenleaf-bakery.example</p>
          </div>
          <SampleTag />
        </div>
        <ol className="mt-1 px-5 pb-16 sm:px-6 lg:pb-20">
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
          <p className="text-xs text-muted">AI named you</p>
          <SampleTag />
        </div>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">31%</span>
          <span className="inline-flex h-7 items-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
            +9 pts
          </span>
        </p>
        <p className="mt-2 text-xs text-muted">of the answers we checked · 22% in September</p>
        <p className="mt-4 inline-flex items-center gap-1.5 border-t border-border pt-3 text-xs text-fg-soft">
          <RotateCcw aria-hidden size={13} />
          Every change we make is recorded and shown to you
        </p>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ example monthly report: three numbers */

/** Made-up numbers for a made-up bakery. Always shown with the "Example" label; never a promise. */
const REPORT_NUMBERS = [
  { label: "Overall score", before: "61", value: "68", note: "out of 100" },
  { label: "AI named you", before: "22%", value: "31%", note: "of the answers we checked" },
  { label: "Fixes done", before: null, value: "9", note: "this month" },
];

/** The monthly report in one simple picture: score up, AI mentions up, fixes done. */
export function ReportExample() {
  return (
    <figure
      aria-label="Example monthly report for a made-up bakery"
      className="relative overflow-hidden rounded-[28px] border border-border bg-surface shadow-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-6 sm:px-9">
        <div className="min-w-0">
          <p className="mk-label">Monthly report</p>
          <p className="mt-2 text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-fg">Greenleaf Bakery · October</p>
        </div>
        <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Example
        </span>
      </div>
      <dl className="grid gap-px bg-border sm:grid-cols-3">
        {REPORT_NUMBERS.map((n) => (
          <div key={n.label} className="bg-surface px-6 py-7 sm:px-7">
            <dt className="text-small font-medium text-fg-soft">{n.label}</dt>
            <dd className="mt-3">
              <span className="flex items-baseline gap-2">
                {n.before && (
                  <span className="text-[1.125rem] tabular-nums text-muted">
                    {n.before}
                    <span aria-hidden> →</span>
                    <span className="sr-only"> last month, now </span>
                  </span>
                )}
                <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">{n.value}</span>
              </span>
              <span className="mt-2 block text-xs text-muted">{n.note}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border bg-surface-2/60 px-6 py-5 text-small leading-relaxed text-fg-soft sm:px-9">
        Fixes this month: delivery areas on the homepage, Google profile hours and photos, 2 new pages, and more. Each one
        is listed in plain words.
      </p>
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
          <Link href={primary.href} {...newTabProps(primary.href)} className={inkPill("lg", true)}>
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

/** `openFirst` shows the first answer without a click (the question most people have). */
export function FaqList({ items, openFirst = false }: { items: { q: string; a: string }[]; openFirst?: boolean }) {
  return (
    <div className="border-t border-fg">
      {items.map((f, i) => (
        <details key={f.q} open={openFirst && i === 0} className="group border-b border-border">
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
