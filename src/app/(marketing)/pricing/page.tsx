import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Table, TD, TH, THead, TR } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import {
  MARKETING_PLANS,
  SERVICE_FROM_PRICE,
  SERVICE_TIERS,
  TRIAL_DAYS,
  freq,
  inr,
  num,
  servicesContactHref,
} from "@/components/marketing/plans";
import { FaqList, ServiceTierCards, ServicesCta } from "@/components/marketing/services-ui";

const SOFTWARE_FROM = Math.min(...MARKETING_PLANS.map((p) => p.price));
const DESCRIPTION = `Two ways to get found in AI answers: self-serve software from ${inr(SOFTWARE_FROM)}/mo with a ${TRIAL_DAYS}-day free trial, or done-for-you service from ${inr(SERVICE_FROM_PRICE)}/mo where our team ships the fixes. Prices in INR, excluding GST.`;

export const metadata: Metadata = {
  title: "Pricing: self-serve software and done-for-you plans",
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { title: `Pricing | ${BRAND.name}`, description: DESCRIPTION, url: "/pricing", siteName: BRAND.name, type: "website" },
};

const SITE = BRAND.appUrl.replace(/\/$/, "");

type Cell = string | boolean;

const ROWS: { label: string; hint?: string; values: Cell[] }[] = [
  { label: "Websites", values: MARKETING_PLANS.map((p) => num(p.limits.maxProjects)) },
  {
    label: "Tracked AI questions",
    hint: "Questions we ask AI assistants about your category",
    values: MARKETING_PLANS.map((p) => num(p.limits.maxTrackedPrompts)),
  },
  { label: "How often we check", values: MARKETING_PLANS.map((p) => freq(p.limits.minScanIntervalDays)) },
  { label: "Pages per site check", values: MARKETING_PLANS.map((p) => num(p.limits.maxPagesPerCrawl)) },
  { label: "Monthly usage credits", values: MARKETING_PLANS.map((p) => num(p.limits.monthlyCredits)) },
  { label: "Competitor comparison", values: MARKETING_PLANS.map((p) => p.limits.competitorTracking) },
  { label: "Approve-before-publish fixes", values: MARKETING_PLANS.map((p) => p.limits.approvalPublishing) },
  { label: "Rollback & audit log", values: MARKETING_PLANS.map(() => true) },
  { label: "Team seats", values: MARKETING_PLANS.map((p) => num(p.limits.seats)) },
  { label: "White-label reports", values: MARKETING_PLANS.map((p) => (p.id === "agency" ? "Coming later" : false)) },
];

const WHICH: { label: string; diy: string; dfy: string }[] = [
  {
    label: "Who does the work",
    diy: "You or your team. We find the problems, explain them and draft the fixes.",
    dfy: "Our team. We plan, write and ship the fixes on your site, profile and listings.",
  },
  {
    label: "Your time each month",
    diy: "A few hours to review fixes and publish them.",
    dfy: "About 30 minutes: approve the plan and read the report.",
  },
  {
    label: "What you get",
    diy: "Scores, AI answer tracking, a fix list and approve-before-publish changes.",
    dfy: "All of the software, plus shipped fixes, new pages, listings and a monthly impact report.",
  },
  {
    label: "Commitment",
    diy: `${TRIAL_DAYS}-day free trial, then monthly. Cancel any time.`,
    dfy: "One-time setup and a 3 or 6-month minimum, then 30 days’ notice.",
  },
  {
    label: "Price",
    diy: `From ${inr(SOFTWARE_FROM)} a month`,
    dfy: `From ${inr(SERVICE_FROM_PRICE)} a month`,
  },
  {
    label: "Best for",
    diy: "Marketers, agencies and owners who like to do it themselves.",
    dfy: "Busy owners who want it handled, and the proof each month.",
  },
];

const PRICING_FAQ = [
  {
    q: "What happens after the free trial?",
    a: `Your ${TRIAL_DAYS}-day trial gives you a full report and a first AI visibility baseline. It only turns into a paid plan if you choose one and add payment details.`,
  },
  {
    q: "What are usage credits?",
    a: "Asking AI assistants questions and checking pages costs us money, so each software plan includes a monthly pool of credits. The app shows how many you've used and stops before you go over.",
  },
  {
    q: "Can I start with the software and switch to done-for-you later?",
    a: "Yes. Your history, questions and reports carry over, so our team starts from your existing baseline. The one-time setup fee still applies.",
  },
  {
    q: "Do any plans guarantee results?",
    a: "No. Software plans cover measurement, auditing and workflow tools. Done-for-you plans guarantee delivery of the agreed fixes, not rankings, AI mentions or citations. Nobody can honestly promise those.",
  },
  {
    q: "Are prices inclusive of GST?",
    a: "No. All prices are in Indian rupees and exclude GST, which is added at the applicable rate.",
  },
];

function CellValue({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="inline-flex items-center justify-center text-success">
        <Check aria-hidden size={18} />
        <span className="sr-only">Included</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center justify-center text-muted">
        <Minus aria-hidden size={18} />
        <span className="sr-only">Not included</span>
      </span>
    );
  return <span className="tabular-nums">{v}</span>;
}

export default function PricingPage() {
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: BRAND.name,
    description: BRAND.tagline,
    brand: { "@type": "Brand", name: BRAND.name },
    offers: MARKETING_PLANS.map((p) => ({
      "@type": "Offer",
      name: `${BRAND.name} ${p.name}`,
      price: String(p.price),
      priceCurrency: "INR",
      url: `${SITE}/pricing#software`,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(p.price),
        priceCurrency: "INR",
        unitCode: "MON",
        valueAddedTaxIncluded: false,
        ...(p.suffix ? { minPrice: String(p.price) } : {}),
      },
    })),
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Done-for-you AI visibility",
    url: `${SITE}/services`,
    provider: { "@type": "Organization", name: BRAND.name, url: SITE },
    offers: SERVICE_TIERS.map((t) => ({
      "@type": "Offer",
      name: `${t.name} (done-for-you)`,
      price: String(t.price),
      priceCurrency: "INR",
      url: `${SITE}/services#plans`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(t.price), priceCurrency: "INR", unitCode: "MON", valueAddedTaxIncluded: false },
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <JsonLd data={[softwareLd, serviceLd, faqLd]} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="pricing-title">
        <div className="container-marketing pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pt-24">
          <p className="mk-label mk-rise">Pricing</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h1 id="pricing-title" className="mk-hero mk-rise mk-delay-1 max-w-[12ch] text-fg lg:col-span-8">
              Do it yourself, <span className="text-primary">or let us do it.</span>
            </h1>
            <p className="mk-lead mk-rise mk-delay-2 max-w-md text-fg-soft lg:col-span-4">
              Use the software and make the fixes yourself, or hand the work to our team and get a report on what it moved.
              Prices in Indian rupees, excluding GST.
            </p>
          </div>

          <nav aria-label="Pricing options" className="mk-rise mk-delay-3 mt-12 sm:mt-16">
            <ul className="grid gap-px overflow-hidden rounded-[22px] border border-border bg-border sm:grid-cols-2">
              <li>
                <a href="#software" className="group flex h-full items-center justify-between gap-4 bg-surface p-6 hover:bg-surface-2 sm:p-8">
                  <span>
                    <span className="block text-small text-muted">Self-serve software</span>
                    <span className="mt-1 block text-[1.375rem] font-semibold tracking-[-0.02em] text-fg">
                      From {inr(SOFTWARE_FROM)}/mo
                    </span>
                    <span className="mt-1 block text-small text-fg-soft">{TRIAL_DAYS}-day free trial · you make the fixes</span>
                  </span>
                  <ArrowRight aria-hidden size={22} className="shrink-0 rotate-90 text-fg transition-transform group-hover:translate-y-0.5" />
                </a>
              </li>
              <li>
                <a href="#done-for-you" className="group flex h-full items-center justify-between gap-4 bg-fg p-6 text-bg hover:bg-fg-soft sm:p-8">
                  <span>
                    <span className="block text-small text-bg/75">Done-for-you service</span>
                    <span className="mt-1 block text-[1.375rem] font-semibold tracking-[-0.02em] text-bg">
                      From {inr(SERVICE_FROM_PRICE)}/mo
                    </span>
                    <span className="mt-1 block text-small text-bg/80">Our team ships the fixes · monthly impact report</span>
                  </span>
                  <ArrowRight aria-hidden size={22} className="shrink-0 rotate-90 transition-transform group-hover:translate-y-0.5" />
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </section>

      {/* ------------------------------------------------------------ Self-serve */}
      <section id="software" aria-labelledby="software-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <p className="mk-label">Self-serve software</p>
              <h2 id="software-title" className="mk-statement mt-5 max-w-[14ch] text-fg">
                You do the fixes. We show you which.
              </h2>
            </div>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              Every plan starts with a {TRIAL_DAYS}-day free trial. Billed monthly, cancel any time.
            </p>
          </div>

          <ul className="mt-16 grid gap-6 lg:mt-20 lg:grid-cols-3 lg:items-stretch">
            {MARKETING_PLANS.map((p) => (
              <li
                key={p.id}
                className={clsx(
                  "mk-reveal relative flex flex-col rounded-[28px] border bg-surface p-7 sm:p-9",
                  p.featured ? "border-fg ring-1 ring-fg" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-fg">{p.name}</h3>
                  {p.featured && (
                    <span className="inline-flex h-7 items-center rounded-full bg-fg px-3 text-xs font-semibold text-bg">Most popular</span>
                  )}
                </div>
                <p className="mt-4 text-[1rem] leading-relaxed text-fg-soft lg:min-h-[4.9em]">{p.blurb}</p>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className="text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">
                    {inr(p.price)}
                    {p.suffix}
                  </span>
                  <span className="text-small text-muted">a month</span>
                </p>
                <p className="mt-4 text-small text-fg-soft">Plus GST · indicative price</p>
                <Link
                  href={p.id === "agency" ? "/contact" : `/signup?plan=${p.id}`}
                  className={clsx(
                    "mt-8 w-full",
                    p.featured
                      ? inkPill("lg")
                      : "inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border-strong px-7 text-[1rem] font-medium text-fg hover:bg-surface-2",
                  )}
                >
                  {p.cta}
                  {p.featured && <ArrowRight aria-hidden />}
                </Link>
                <ul className="mt-9 flex-1 space-y-3.5 border-t border-border pt-7">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex gap-3 text-[0.9375rem] leading-snug text-fg-soft">
                      <span aria-hidden className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
                        <Check size={12} strokeWidth={2.75} />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <details className="group mk-reveal mt-12 rounded-[22px] border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 sm:px-8 [&::-webkit-details-marker]:hidden">
              <span className="text-[1.125rem] font-semibold tracking-[-0.015em] text-fg">Compare software plans in detail</span>
              <span
                aria-hidden
                className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-fg transition-transform duration-200 group-open:rotate-45"
              >
                <span className="absolute h-px w-3 bg-current" />
                <span className="absolute h-3 w-px bg-current" />
              </span>
            </summary>
            <div className="border-t border-border">
              <Table caption="Feature comparison across Starter, Growth and Agency software plans" zebra>
                <THead>
                  <tr>
                    <TH className="w-[40%]">Feature</TH>
                    {MARKETING_PLANS.map((p) => (
                      <TH key={p.id} align="center">
                        {p.name}
                      </TH>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {ROWS.map((r) => (
                    <TR key={r.label}>
                      <TD className="font-medium text-fg">
                        {r.label}
                        {r.hint && <span className="block text-xs font-normal text-muted">{r.hint}</span>}
                      </TD>
                      {r.values.map((v, i) => (
                        <TD key={i} className="text-center">
                          <CellValue v={v} />
                        </TD>
                      ))}
                    </TR>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-border px-6 py-4 text-small text-muted sm:px-8">
                Limits above are the ones the app enforces. Not sure which fits? The free trial mirrors Starter limits with a
                smaller credit pool, and you can pick a plan later.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ------------------------------------------------------------ Done-for-you */}
      <section id="done-for-you" aria-labelledby="dfy-title" className="scroll-mt-20 border-t border-border py-24 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <p className="mk-label">Done-for-you</p>
              <h2 id="dfy-title" className="mk-statement mt-5 max-w-[14ch] text-fg">
                We do the fixes. You get the proof.
              </h2>
            </div>
            <div className="max-w-md lg:col-span-4 lg:col-start-9">
              <p className="mk-lead text-fg-soft">
                Our team ships agreed fixes every month and reports what they moved. Includes the software.
              </p>
              <Link
                href="/services"
                className="mt-5 inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
              >
                How the service works
                <ArrowRight aria-hidden size={17} />
              </Link>
            </div>
          </div>
          <ServiceTierCards className="mt-16 lg:mt-20" />
          <p className="mt-8 max-w-3xl text-small text-muted">
            Prices exclude GST. Setup is charged once; minimum terms then month to month with 30 days&apos; notice. If we
            don&apos;t ship the fixes promised for a month, you get 25% of that month&apos;s fee back. We never guarantee
            rankings or placements.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ Which is right */}
      <section id="which" aria-labelledby="which-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-28">
        <div className="container-marketing">
          <h2 id="which-title" className="mk-reveal mk-statement max-w-[14ch] text-fg">
            Which is right for me?
          </h2>
          <WhichTable />
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border py-24 sm:py-28">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <h2 id="faq-title" className="mk-title max-w-[12ch] text-fg">
              Pricing questions.
            </h2>
            <p className="mk-body mt-5 max-w-sm text-fg-soft">
              Something else?{" "}
              <Link href="/contact" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                Write to us
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <FaqList items={PRICING_FAQ} />
          </div>
        </div>
      </section>

      <ServicesCta
        title="Not sure yet? Start with the free check."
        body={<p>It reads your homepage and key pages and shows your scores and top fixes. Then decide who does them.</p>}
        primary={{ href: "/free-check", label: "Run the free check" }}
        secondary={{ href: servicesContactHref(), label: "Book a strategy call" }}
        footnote={`${TRIAL_DAYS}-day free trial on software. Prices in INR, excluding GST. No guaranteed rankings, ever.`}
      />
    </>
  );
}

function WhichTable() {
  return (
    <>
      {/* Wide screens: a three-column table. */}
      <div className="mk-reveal mt-14 hidden overflow-hidden rounded-[28px] border border-border bg-surface md:block lg:mt-20">
        <table className="w-full table-fixed text-left">
          <caption className="sr-only">Self-serve software compared with done-for-you service</caption>
          <thead>
            <tr className="border-b border-border">
              <td className="w-[24%] p-8" />
              <th scope="col" className="p-8 align-bottom">
                <span className="block text-small font-medium text-muted">Do it yourself</span>
                <span className="mt-1 block text-[1.5rem] font-semibold tracking-[-0.02em] text-fg">Software</span>
              </th>
              <th scope="col" className="bg-fg p-8 align-bottom">
                <span className="block text-small font-medium text-bg/75">We do it</span>
                <span className="mt-1 block text-[1.5rem] font-semibold tracking-[-0.02em] text-bg">Done-for-you</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {WHICH.map((r) => (
              <tr key={r.label} className="border-b border-border">
                <th scope="row" className="p-8 align-top text-small font-semibold text-fg">
                  {r.label}
                </th>
                <td className="p-8 align-top text-[0.9375rem] leading-relaxed text-fg-soft">{r.diy}</td>
                <td className="bg-surface-2/70 p-8 align-top text-[0.9375rem] leading-relaxed text-fg">{r.dfy}</td>
              </tr>
            ))}
            <tr>
              <td />
              <td className="p-8">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-6 text-[0.9375rem] font-medium text-fg hover:bg-surface-2"
                >
                  Start free trial
                </Link>
              </td>
              <td className="bg-surface-2/70 p-8">
                <Link href="/services" className={inkPill("md", false, "h-12 px-6")}>
                  See done-for-you
                  <ArrowRight aria-hidden />
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Small screens: two stacked panels. */}
      <div className="mt-12 grid gap-5 md:hidden">
        {(
          [
            { key: "diy", kicker: "Do it yourself", name: "Software", ink: false, href: "/signup", cta: "Start free trial" },
            { key: "dfy", kicker: "We do it", name: "Done-for-you", ink: true, href: "/services", cta: "See done-for-you" },
          ] as const
        ).map((c) => (
          <div key={c.key} className={clsx("rounded-[24px] p-6", c.ink ? "bg-fg text-bg" : "border border-border bg-surface")}>
            <p className={clsx("text-small font-medium", c.ink ? "text-bg/75" : "text-muted")}>{c.kicker}</p>
            <h3 className={clsx("mt-1 text-[1.5rem] font-semibold tracking-[-0.02em]", c.ink ? "text-bg" : "text-fg")}>{c.name}</h3>
            <dl className={clsx("mt-5 divide-y", c.ink ? "divide-bg/15" : "divide-border")}>
              {WHICH.map((r) => (
                <div key={r.label} className="py-3.5">
                  <dt className={clsx("text-xs font-semibold", c.ink ? "text-bg" : "text-fg")}>{r.label}</dt>
                  <dd className={clsx("mt-1 text-[0.9375rem] leading-relaxed", c.ink ? "text-bg/80" : "text-fg-soft")}>
                    {c.key === "diy" ? r.diy : r.dfy}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href={c.href}
              className={
                c.ink
                  ? inkPill("md", true, "mt-5 h-12 w-full")
                  : "mt-5 inline-flex h-12 w-full items-center justify-center rounded-full border border-border-strong text-[0.9375rem] font-medium text-fg hover:bg-surface-2"
              }
            >
              {c.cta}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
