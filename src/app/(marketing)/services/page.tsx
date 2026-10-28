import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { SERVICE_FROM_PRICE, SERVICE_TIERS, inr, servicesContactHref } from "@/components/marketing/plans";
import {
  DeliveryComposition,
  FaqList,
  ImpactReportSample,
  ServiceTierCards,
  ServicesCta,
} from "@/components/marketing/services-ui";

const TITLE = "Done-for-you AI visibility services";
const DESCRIPTION = `We fix your website, Google Business Profile and listings every month so AI assistants can find and quote you, and send a monthly impact report with the evidence. Plans from ${inr(SERVICE_FROM_PRICE)}/month plus GST.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services" },
  openGraph: {
    title: `${TITLE} | ${BRAND.name}`,
    description: DESCRIPTION,
    url: "/services",
    siteName: BRAND.name,
    type: "website",
  },
};

const SITE = BRAND.appUrl.replace(/\/$/, "");

const STEPS = [
  {
    when: "Week 1",
    title: "Baseline audit",
    body: "We read your site, check your Google Business Profile and ask AI assistants about your business. That becomes the “before” every report compares against.",
  },
  {
    when: "Week 1–2",
    title: "Agree the buyer questions",
    body: "Together we choose the questions your customers really ask, like “best eggless bakery near me”. You approve the list and the first month’s fix plan.",
  },
  {
    when: "Every month",
    title: "We ship the fixes",
    body: "Our team makes the agreed changes on your site, profile and listings. Each one is logged, and anything can be rolled back in one click.",
  },
  {
    when: "Month end",
    title: "Monthly impact report",
    body: "What we shipped, what moved, what didn’t, and what’s next. In plain English, with the saved AI answers as evidence.",
  },
];

const REPORT_PARTS = [
  {
    title: "Delivery against the plan",
    body: "Every fix we agreed, and whether it shipped. No vague “ongoing optimisation”.",
  },
  {
    title: "What changed in AI answers",
    body: "Mention and link rates per engine, compared with last month, with the sample size.",
  },
  {
    title: "Scores before and after",
    body: "Your SEO, AEO, GEO and brand scores from the same checks we ran at the start.",
  },
  {
    title: "What didn’t work",
    body: "Where nothing moved, we say so, and suggest what we try next.",
  },
  {
    title: "Next month’s plan",
    body: "The fixes we propose, for you to approve before we start.",
  },
];

const PROMISES = [
  {
    title: "You own everything",
    body: "Your website, profiles, listings and every word we write stay yours. We work in your accounts with access you can remove at any time.",
  },
  {
    title: "Nothing happens in the dark",
    body: "You get a live dashboard and a change log of every edit we make, with one-click rollback for anything you don’t like.",
  },
  {
    title: "Short minimums, then 30 days’ notice",
    body: "Three or six months to give the work a fair chance, then month to month. Leave with 30 days’ notice, no exit fees.",
  },
  {
    title: "A delivery guarantee",
    body: "If we don’t ship the fixes we promised for a month, you get 25% of that month’s fee back. Delays caused by waiting on access or approvals don’t count.",
  },
  {
    title: "No ranking or placement guarantees. Ever.",
    body: "AI answers are written by other companies’ systems. Anyone who guarantees you a spot is guessing. We guarantee the work, and show you honestly what it moved.",
  },
];

const FAQ = [
  {
    q: "How is this different from the self-serve software?",
    a: `With the software, ${BRAND.name} finds the problems and drafts the fixes, and your team does the work. With done-for-you, our team does the work: we agree a plan with you, ship the fixes every month and report on the impact. You still get the live dashboard.`,
  },
  {
    q: "Do you guarantee rankings or mentions in ChatGPT?",
    a: "No. Nobody controls what AI assistants say, and anyone who promises a ranking or a placement is guessing. We guarantee delivery: if we don't ship the fixes promised for a month, you get 25% of that month's fee back.",
  },
  {
    q: "What do you need from me?",
    a: "Access to your website and a manager role on your Google Business Profile, about an hour in the first two weeks to agree the buyer questions, and quick approvals for anything that changes what your business says publicly.",
  },
  {
    q: "What does the setup fee cover?",
    a: "The baseline audit, research into the questions your buyers ask, setting up tracking across five AI engines, and the first month's fix plan. It is charged once.",
  },
  {
    q: "What happens after the minimum term?",
    a: "Your plan continues month to month. You can change tier or leave with 30 days' notice. You keep all the content, accounts and reports.",
  },
  {
    q: "Is Reddit and forum participation honest?",
    a: "Yes. On Authority, our team only joins conversations where your business is genuinely relevant, and always discloses who we represent. No fake reviews, no sock-puppet accounts.",
  },
  {
    q: "Are prices inclusive of GST?",
    a: "No. All prices are in Indian rupees and exclude GST, which is added at the applicable rate.",
  },
];

export default function ServicesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: TITLE,
      serviceType: "AI search visibility (SEO, AEO and GEO) management",
      description: DESCRIPTION,
      url: `${SITE}/services`,
      areaServed: { "@type": "Country", name: "India" },
      provider: {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: BRAND.name,
        url: SITE,
      },
      offers: SERVICE_TIERS.map((t) => ({
        "@type": "Offer",
        name: `${t.name} (done-for-you)`,
        url: `${SITE}/services#plans`,
        priceCurrency: "INR",
        price: String(t.price),
        priceSpecification: [
          {
            "@type": "UnitPriceSpecification",
            price: String(t.price),
            priceCurrency: "INR",
            unitCode: "MON",
            valueAddedTaxIncluded: false,
          },
          {
            "@type": "UnitPriceSpecification",
            name: "One-time setup",
            price: String(t.setup),
            priceCurrency: "INR",
            valueAddedTaxIncluded: false,
          },
        ],
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="services-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
          <p className="mk-label mk-rise">Done-for-you AI visibility</p>
          <div className="mt-6 grid gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="mk-rise mk-delay-1 min-w-0 lg:col-span-7">
              <h1 id="services-title" className="mk-hero max-w-[14ch] lg:text-[clamp(4rem,1.2rem+4.2vw,6.25rem)] text-fg">
                We fix it. <br />
                <span className="text-primary">You see the proof every month.</span>
              </h1>
              <p className="mk-lead mt-9 max-w-[34rem] text-fg-soft">
                Our team makes the changes that help ChatGPT, Gemini and Google&apos;s AI find, trust and quote your business.
                Every month you get a report showing exactly what we shipped and what it moved.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
                <Link href={servicesContactHref()} className={inkPill("lg")}>
                  Book a free strategy call
                  <ArrowRight aria-hidden />
                </Link>
                <Link
                  href="/free-check"
                  className="inline-flex items-center gap-1.5 self-start text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg sm:self-auto"
                >
                  Start with a free check
                  <ArrowRight aria-hidden size={17} />
                </Link>
              </div>
              <p className="mt-8 text-small text-muted">
                From {inr(SERVICE_FROM_PRICE)} a month, plus GST. You own every account and every word.
              </p>
            </div>
            <div className="mk-rise mk-delay-3 min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-6">
              <DeliveryComposition />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ How it works */}
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="scroll-mt-20 border-y border-border bg-surface-2/50 py-24 sm:py-32"
      >
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h2 id="how-title" className="mk-statement max-w-[13ch] text-fg lg:col-span-7">
              A clear plan. Then the work, every month.
            </h2>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              No 80-page audit that sits in a drawer. Small, agreed fixes, shipped on a schedule you can check.
            </p>
          </div>
          <ol className="mt-16 grid gap-12 sm:grid-cols-2 sm:gap-x-10 lg:mt-24 lg:grid-cols-4 lg:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="mk-reveal">
                <span aria-hidden className="mk-outline-num block text-[clamp(5rem,3.5rem+5vw,9rem)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-6 text-small font-medium text-primary">{s.when}</p>
                <h3 className="mt-2 text-[1.375rem] font-semibold tracking-[-0.02em] text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Plans */}
      <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <p className="mk-label">Plans</p>
              <h2 id="plans-title" className="mk-statement mt-5 max-w-[14ch] text-fg">
                Three ways to hand it over.
              </h2>
            </div>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              Every plan includes the live dashboard, a change log of every edit and a monthly impact report.
            </p>
          </div>
          <ServiceTierCards className="mt-16 lg:mt-20" />
          <p className="mt-8 max-w-3xl text-small text-muted">
            Prices in Indian rupees, excluding GST. Setup is charged once. After the minimum term, plans run month to month with
            30 days&apos; notice. Prefer to do the work yourself?{" "}
            <Link
              href="/pricing#software"
              className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              See the self-serve plans
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ Monthly impact report */}
      <section
        id="report"
        aria-labelledby="report-title"
        className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-32"
      >
        <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="mk-reveal lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 id="report-title" className="mk-title max-w-[14ch] text-fg">
                What&apos;s in your monthly impact report
              </h2>
              <ol className="mt-10 border-t border-fg">
                {REPORT_PARTS.map((r, i) => (
                  <li key={r.title} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-border py-5">
                    <span className="text-small font-medium tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">{r.title}</span>
                      <span className="mt-1 block text-[0.9375rem] leading-relaxed text-fg-soft">{r.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-8 lg:col-start-5 xl:col-span-7 xl:col-start-6">
            <ImpactReportSample />
            <p className="mt-4 text-xs text-muted">
              A sample report for a fictional business. Your report uses your own questions, pages and saved AI answers.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Promises */}
      <section id="promises" aria-labelledby="promises-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="mk-reveal lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <h2 id="promises-title" className="mk-statement max-w-[10ch] text-fg">
                Our promises.
              </h2>
              <p className="mk-lead mt-6 max-w-md text-fg-soft">
                Hiring an agency shouldn&apos;t feel like a leap of faith. These are written into every agreement.
              </p>
            </div>
          </div>
          <ul className="lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
            {PROMISES.map((p, i) => (
              <li
                key={p.title}
                className="mk-reveal grid gap-2 border-t border-border py-7 first:border-fg sm:grid-cols-[3rem_1fr] sm:gap-6"
              >
                <span className="text-small font-medium tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-fg">{p.title}</h3>
                  <p className="mk-body mt-2 text-fg-soft">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 id="faq-title" className="mk-title max-w-[12ch] text-fg">
                Questions before you hire us.
              </h2>
              <p className="mk-body mt-5 max-w-sm text-fg-soft">
                Something else?{" "}
                <Link
                  href={servicesContactHref()}
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  Ask us on a free call
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <FaqList items={FAQ} />
          </div>
        </div>
      </section>

      <ServicesCta
        title="See what we would fix first."
        body={
          <p>
            A free 30-minute call. We look at your site and your AI answers with you, and tell you honestly whether we can help.
          </p>
        }
        primary={{
          href: servicesContactHref(),
          label: "Book a free strategy call",
        }}
        secondary={{ href: "/free-check", label: "Start with a free check" }}
        footnote="Prices in Indian rupees, excluding GST. We promise delivery, never rankings or placements."
      />
    </>
  );
}
