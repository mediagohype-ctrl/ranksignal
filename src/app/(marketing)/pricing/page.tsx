import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { ProofLine } from "@/components/marketing/proof-line";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import {
  CUSTOM_CONTACT_HREF,
  CUSTOM_PLAN,
  DFY_PLAN,
  SELF_PLAN,
  TRIAL_DAYS,
  gstOn,
  inr,
  planSignupHref,
  servicesContactHref, newTabProps,
} from "@/components/marketing/plans";
import { FaqList } from "@/components/marketing/services-ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/pricing");

const SITE = BRAND.appUrl.replace(/\/$/, "");

/** "₹1,999/month + GST" — one GST mention per price, none when we are not GST-registered. */
const monthly = (n: number) => `${inr(n)}/month${gstOn() ? " + GST" : ""}`;

interface PlanCard {
  key: string;
  name: string;
  price: string;
  line: string;
  start: string;
  term?: string;
  cta: string;
  href: string;
  dark?: boolean;
  tag?: string;
  listTitle: string;
  list: readonly string[];
}

const CARDS: PlanCard[] = [
  {
    key: "self",
    name: "I'll do it myself",
    price: monthly(SELF_PLAN.price),
    line: SELF_PLAN.blurb,
    start: `${TRIAL_DAYS} days free. No card needed. Cancel any time.`,
    cta: SELF_PLAN.cta,
    href: planSignupHref(SELF_PLAN.id),
    listTitle: "What you get",
    list: SELF_PLAN.highlights,
  },
  {
    key: "dfy",
    name: DFY_PLAN.name,
    price: monthly(DFY_PLAN.price),
    line: DFY_PLAN.blurb,
    start: `Free 30-minute call.${DFY_PLAN.setup === 0 ? " No setup fee." : ""}`,
    term: DFY_PLAN.termNote,
    cta: "Book a free call",
    href: servicesContactHref("fix"),
    dark: true,
    tag: "Most chosen",
    listTitle: DFY_PLAN.inherits ?? "What you get",
    list: DFY_PLAN.includes,
  },
  {
    key: "custom",
    name: CUSTOM_PLAN.name,
    price: CUSTOM_PLAN.priceLabel,
    line: CUSTOM_PLAN.blurb,
    start: CUSTOM_PLAN.start,
    cta: CUSTOM_PLAN.cta,
    href: CUSTOM_CONTACT_HREF,
    listTitle: "What you get",
    list: CUSTOM_PLAN.includes,
  },
];

const WHICH: { label: string; diy: string; dfy: string }[] = [
  { label: "Who does the work", diy: "You, with our step-by-step help", dfy: "Our team" },
  { label: "Your time each month", diy: "2–3 hours", dfy: "15 minutes to say OK" },
  { label: "Best for", diy: "Owners who like to do it themselves", dfy: "Busy owners who want it done" },
];

const PRICING_FAQ = [
  { q: `What happens after ${TRIAL_DAYS} days?`, a: "Pick a plan, or do nothing and pay nothing." },
  { q: "Can I switch plans later?", a: "Yes, any time. Your history moves with you." },
  {
    q: `Why ${DFY_PLAN.minimumMonths} months for ${DFY_PLAN.name}?`,
    a: `Google and AI need a few weeks to notice changes. ${DFY_PLAN.minimumMonths} months shows real progress.`,
  },
  { q: "Do you promise #1 on Google?", a: "No one honestly can. We promise the work, and show you every result." },
];

export default function PricingPage() {
  const offer = (name: string, price: number, url: string) => ({
    "@type": "Offer",
    name,
    price: String(price),
    priceCurrency: "INR",
    url,
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(price),
      priceCurrency: "INR",
      unitCode: "MON",
      ...(gstOn() ? { valueAddedTaxIncluded: false } : {}),
    },
  });

  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: BRAND.name,
    description: BRAND.tagline,
    brand: { "@type": "Brand", name: BRAND.name },
    offers: [offer(`${BRAND.name} ${SELF_PLAN.name}`, SELF_PLAN.price, `${SITE}/pricing#plans`)],
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Done-for-you website fixes for Google and AI",
    url: `${SITE}/services`,
    provider: { "@type": "Organization", name: BRAND.name, url: SITE },
    offers: [offer(DFY_PLAN.name, DFY_PLAN.price, `${SITE}/pricing#plans`)],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <JsonLd data={[webPageLd("/pricing", { base: SITE }), softwareLd, serviceLd, faqLd]} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="pricing-title">
        <div className="container-marketing pb-12 pt-14 sm:pb-16 sm:pt-20 lg:pt-24">
          <p className="mk-label mk-rise">SEO, AEO &amp; GEO pricing</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h1 id="pricing-title" className="mk-hero mk-rise mk-delay-1 max-w-[14ch] text-fg lg:col-span-8">
              Simple pricing. <span className="text-primary">You choose who does the work.</span>
            </h1>
            <div className="mk-rise mk-delay-2 max-w-md lg:col-span-4">
              <p className="mk-lead text-fg-soft">
                {gstOn() ? "Prices in ₹. GST extra. No hidden costs." : "Prices in ₹. No hidden costs."}
              </p>
              <ProofLine className="mt-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Plans */}
      <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="plans-title" className="sr-only">
            Plans
          </h2>
          <ul className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {CARDS.map((c) => (
              <li
                key={c.key}
                className={clsx(
                  "mk-reveal relative flex flex-col rounded-[28px] p-7 sm:p-9",
                  c.dark
                    ? "order-first bg-fg text-bg shadow-card lg:order-none lg:-my-4 lg:py-12"
                    : "border border-border bg-surface",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className={clsx("text-[1.75rem] font-semibold leading-none tracking-[-0.03em]", c.dark ? "text-bg" : "text-fg")}>
                    {c.name}
                  </h3>
                  {c.tag && (
                    <span className="inline-flex h-7 items-center rounded-full bg-bg px-3 text-xs font-semibold text-fg">{c.tag}</span>
                  )}
                </div>
                <p className={clsx("mt-4 text-[1rem] leading-relaxed", c.dark ? "text-bg/80" : "text-fg-soft")}>{c.line}</p>
                <p
                  className={clsx(
                    "mt-8 text-[clamp(1.875rem,1.6rem+1vw,2.5rem)] font-semibold leading-tight tracking-[-0.04em] tabular-nums",
                    c.dark ? "text-bg" : "text-fg",
                  )}
                >
                  {c.price}
                </p>
                <p className={clsx("mt-3 text-small font-medium", c.dark ? "text-bg" : "text-fg")}>{c.start}</p>
                {c.term && <p className="mt-1 text-small text-bg/75">{c.term}</p>}
                <Link
                  href={c.href}
                  {...newTabProps(c.href)}
                  className={
                    c.dark
                      ? inkPill("lg", true, "mt-8 w-full")
                      : "mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border border-border-strong px-7 text-[1rem] font-medium text-fg hover:bg-surface-2"
                  }
                >
                  {c.cta}
                  {c.dark && <ArrowRight aria-hidden />}
                </Link>
                <div className={clsx("mt-9 flex-1 border-t pt-7", c.dark ? "border-bg/15" : "border-border")}>
                  <h4 className={clsx("text-small font-semibold", c.dark ? "text-bg" : "text-fg")}>{c.listTitle}</h4>
                  <ul className="mt-4 space-y-3.5">
                    {c.list.map((h) => (
                      <li key={h} className={clsx("flex gap-3 text-[0.9375rem] leading-snug", c.dark ? "text-bg/85" : "text-fg-soft")}>
                        <span
                          aria-hidden
                          className={clsx(
                            "mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                            c.dark ? "bg-bg/15 text-bg" : "bg-primary-soft text-primary-soft-fg",
                          )}
                        >
                          <Check size={12} strokeWidth={2.75} />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Proof */}
      <section aria-label="Proof" className="border-t border-border py-16 sm:py-20">
        <div className="container-marketing">
          <p className="mk-reveal flex items-center justify-center gap-3 text-center text-[clamp(1.5rem,1.2rem+1.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-fg">
            <Check aria-hidden className="size-[1em] shrink-0 text-success" />
            {BRAND.proof}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ Which is right */}
      <section id="which" aria-labelledby="which-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="which-title" className="mk-reveal mk-title max-w-[16ch] text-fg">
            Which is right for me?
          </h2>
          <div className="mk-reveal mt-10 overflow-hidden rounded-[24px] border border-border bg-surface">
            <table className="w-full table-fixed text-left">
              <caption className="sr-only">
                {SELF_PLAN.name} compared with {DFY_PLAN.name}
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <td className="w-[30%] p-4 sm:p-6" />
                  <th scope="col" className="p-4 align-bottom text-[0.9375rem] font-semibold text-fg sm:p-6 sm:text-[1.125rem]">
                    {SELF_PLAN.name}
                  </th>
                  <th scope="col" className="bg-fg p-4 align-bottom text-[0.9375rem] font-semibold text-bg sm:p-6 sm:text-[1.125rem]">
                    {DFY_PLAN.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {WHICH.map((r, i) => (
                  <tr key={r.label} className={clsx(i < WHICH.length - 1 && "border-b border-border")}>
                    <th scope="row" className="p-4 align-top text-small font-semibold text-fg sm:p-6">
                      {r.label}
                    </th>
                    <td className="p-4 align-top text-small leading-relaxed text-fg-soft sm:p-6 sm:text-[0.9375rem]">{r.diy}</td>
                    <td className="bg-surface-2/70 p-4 align-top text-small leading-relaxed text-fg sm:p-6 sm:text-[0.9375rem]">{r.dfy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
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

      {/* ------------------------------------------------------------ Final button */}
      <section aria-labelledby="final-title" className="border-t border-border bg-fg py-20 text-bg sm:py-24">
        <div className="container-marketing flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="final-title" className="mk-title max-w-[18ch] text-bg">
            Not sure yet? See your scores first.
          </h2>
          <Link href="/free-check" className={inkPill("lg", true, "w-full sm:w-auto")}>
            Check my website free
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
