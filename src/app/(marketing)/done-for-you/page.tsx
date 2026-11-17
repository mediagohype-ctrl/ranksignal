import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MessageCircleQuestion, Wallet } from "lucide-react";
import { BRAND, bookCallHref } from "@/lib/brand";
import { ProofLine } from "@/components/marketing/proof-line";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { CUSTOM_CONTACT_HREF, DFY_PLAN, gstOn, inr, priceNote, servicesContactHref, newTabProps } from "@/components/marketing/plans";
import {
  DeliveryComposition,
  FaqList,
  ReportExample,
  ServiceTierCards,
  ServicesCta,
} from "@/components/marketing/services-ui";
import { ServiceFlow } from "@/components/marketing/flow/service-flow";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";

const TITLE = "SEO, AEO & GEO Services in India — done-for-you SEO company";
const DESCRIPTION = `Done-for-you SEO, AEO and GEO services from an India-based team: we fix your website, Google Business Profile and listings every month so Google and ChatGPT can find and quote you, with a monthly proof report. ${DFY_PLAN.name}: ${inr(DFY_PLAN.price)}/month${gstOn() ? " plus GST" : ""}, no setup fee, ${DFY_PLAN.termNote}.`;

// TITLE / DESCRIPTION above describe the Service in JSON-LD; the search snippet lives in src/lib/seo/pages.ts.
export const metadata: Metadata = staticPageMetadata("/done-for-you");

const SITE = BRAND.appUrl.replace(/\/$/, "");

/** Where every "Book a free call" button on this page goes (the calendar once it exists, else the contact page). */
const CALL_HREF = bookCallHref(servicesContactHref());

/** The first 30 days, as one strip (who does what at each step lives in ServiceFlow). */
const STEPS = [
  { when: "Day 1", title: "A call" },
  { when: "Week 1", title: "Your plan" },
  { when: "Week 2", title: "First fixes" },
  { when: "Day 30", title: "Your report" },
];

const FAMILIAR = [
  {
    icon: Clock,
    title: "No time for SEO",
    body: "You have a business to run. We do the work and ask for a quick OK when we need one.",
  },
  {
    icon: Wallet,
    title: "Paid an agency, saw nothing",
    body: "You get a list of every fix we make and a short report each month, so you always know what was done.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Don’t know what ChatGPT says about you",
    body: "We ask the AI assistants the questions your customers ask, show you the answers and correct wrong facts.",
  },
];

const REPORT_PARTS = [
  {
    title: "Delivery against the plan",
    body: "Every fix we made this month, in plain words. No vague “ongoing work”.",
  },
  {
    title: "What changed in AI answers",
    body: "How often each AI assistant named you and linked to you, compared with last month, and how many answers that's based on.",
  },
  {
    title: "Scores before and after",
    body: "Your four scores, from the same checks we ran at the start.",
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
    body: "Your website, profiles, listings and every page and article we write are yours to keep, even if you leave. We work in your accounts with access you can remove at any time.",
  },
  {
    title: "Nothing happens in the dark",
    body: "You get a live dashboard and a list of every edit we make, with one-click undo for changes on your connected website.",
  },
  {
    title: "Three months, then 30 days’ notice",
    body: "Three months to give the work a fair chance, then month to month. No setup fee. Leave with 30 days’ notice, no exit fees.",
  },
  {
    title: "Your own expert on WhatsApp",
    body: "One person on our team who knows your business. Message them on WhatsApp whenever you have a question.",
  },
  {
    title: "No promises about Google or AI positions. Ever.",
    body: "AI answers are written by other companies’ systems. Anyone who guarantees you a spot is guessing. We guarantee the work, and show you honestly what it moved.",
  },
];

const FAQ = [
  {
    q: "How is this different from the self-serve software?",
    a: `With the software, ${BRAND.name} finds the problems and drafts the fixes, and your team does the work. With done-for-you, our team does the work: we agree a plan with you, make the fixes every month and report on what changed. You still get the live dashboard.`,
  },
  {
    q: "Do you promise a top Google spot or mentions in ChatGPT?",
    a: "No. Nobody controls what Google or AI assistants show, and anyone who promises a position is guessing. We promise the work, and show you every result in your monthly report.",
  },
  {
    q: "What do you need from me?",
    a: "Access to your website and a manager role on your Google Business Profile, about an hour in the first two weeks to agree the customer questions, and quick approvals for anything that changes what your business says publicly.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. You pay the monthly fee only. The first check, the customer questions and the first month's fix plan are part of it.",
  },
  {
    q: "What happens after the first three months?",
    a: "Your plan continues month to month. You can leave with 30 days' notice. You keep all the content, accounts and reports.",
  },
  {
    q: "I have many websites, brands or cities. Can you help?",
    a: "Yes. Talk to us about a Custom plan: many websites, brands or cities, a dedicated team, reports with your logo for agencies, and API and dashboard access.",
  },
  {
    q: "Are prices inclusive of GST?",
    a: gstOn()
      ? "No. All prices are in Indian rupees and exclude GST, which is added at the applicable rate."
      : "All prices are in Indian rupees. We are not GST-registered yet, so no GST is added.",
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
      url: `${SITE}/done-for-you`,
      areaServed: { "@type": "Country", name: "India" },
      provider: {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: BRAND.name,
        url: SITE,
      },
      offers: {
        "@type": "Offer",
        name: `${DFY_PLAN.name} (done-for-you)`,
        url: `${SITE}/done-for-you#plans`,
        priceCurrency: "INR",
        price: String(DFY_PLAN.price),
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: String(DFY_PLAN.price),
          priceCurrency: "INR",
          unitCode: "MON",
          valueAddedTaxIncluded: false,
        },
      },
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
      <JsonLd data={[webPageLd("/done-for-you",{ base: SITE }), ...jsonLd]} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="services-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
          <p className="mk-label mk-rise">Done-for-you SEO, AEO &amp; GEO services</p>
          <div className="mt-6 grid gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="mk-rise mk-delay-1 min-w-0 lg:col-span-7">
              <h1 id="services-title" className="mk-hero max-w-[15ch] text-fg lg:text-[clamp(3.25rem,1.2rem+3.4vw,5.25rem)]">
                We get your business found. <br />
                <span className="text-primary">You get on with your work.</span>
              </h1>
              <p className="mk-lead mt-9 max-w-[34rem] text-fg-soft">
                Our team makes the changes that help ChatGPT, Gemini and Google&apos;s AI find, trust and quote your business.
                Every month you get a report showing exactly what we did and what changed.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
                <Link href={CALL_HREF} {...newTabProps(CALL_HREF)} className={inkPill("lg")}>
                  Book a free call
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
              <p className="mt-4 max-w-[34rem] text-small text-fg-soft">
                On the call, we&apos;ll show you 3 things your competitors do better online. Free.
              </p>
              <ProofLine className="mt-8" />
              <p className="mt-3 text-small text-muted">
                {DFY_PLAN.name}: {inr(DFY_PLAN.price)} a month{gstOn() ? ", plus GST" : ""}. No setup fee. You own every account
                and every word.
              </p>
            </div>
            <div className="mk-rise mk-delay-3 min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-6">
              <DeliveryComposition />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Sound familiar? */}
      <section aria-labelledby="familiar-title" className="border-t border-border py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="familiar-title" className="mk-reveal mk-title text-fg">
            Sound familiar?
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {FAMILIAR.map((f) => (
              <li key={f.title} className="mk-reveal rounded-[22px] border border-border bg-surface p-6 sm:p-7">
                <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
                  <f.icon size={19} />
                </span>
                <h3 className="mt-5 text-[1.25rem] font-semibold tracking-[-0.02em] text-fg">{f.title}</h3>
                <p className="mk-body mt-2 text-fg-soft">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ How it works: one 4-step strip */}
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="scroll-mt-20 border-y border-border bg-surface-2/50 py-24 sm:py-32"
      >
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h2 id="how-title" className="mk-statement max-w-[13ch] text-fg lg:col-span-7">
              Your first 30 days.
            </h2>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              Our team does the work. Your part is giving access, a quick OK when we ask, and about 30 minutes with the
              monthly report.
            </p>
          </div>
          <ServiceFlow steps={STEPS} className="mt-14 lg:mt-20" />
        </div>
      </section>

      {/* ------------------------------------------------------------ Plans */}
      <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <p className="mk-label">Price</p>
              <h2 id="plans-title" className="mk-statement mt-5 max-w-[14ch] text-fg">
                One plan. We do the work.
              </h2>
            </div>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              It includes the live dashboard, a list of every edit and a monthly report. Bigger needs?{" "}
              <Link
                href={CUSTOM_CONTACT_HREF}
                {...newTabProps(CUSTOM_CONTACT_HREF)}
                className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                Talk to us about Custom
              </Link>
              .
            </p>
          </div>
          <ServiceTierCards withCustom className="mt-16 lg:mt-20" />
          <p className="mt-8 max-w-3xl text-small text-muted">
            {priceNote()} No setup fee. After the first {DFY_PLAN.minimumMonths} months, the plan runs month to month with
            30 days&apos; notice. Prefer to do the work yourself?{" "}
            <Link
              href="/pricing#software"
              className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              See Do it myself
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
                What&apos;s in your monthly report
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
            <ReportExample />
            <p className="mt-4 text-xs text-muted">
              An example with made-up numbers, not a real customer. Your report uses your own website, questions and saved
              AI answers. We never promise a result.
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
              <p className="mk-body mt-6 max-w-md text-fg-soft">
                We work within Google&apos;s own rules: its advice on{" "}
                <a
                  href="https://developers.google.com/search/docs/fundamentals/do-i-need-seo"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  hiring an SEO
                </a>{" "}
                and its{" "}
                <a
                  href="https://developers.google.com/search/docs/essentials/spam-policies"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  spam policies
                </a>
                . Business details we add use the standard{" "}
                <a
                  href="https://schema.org/LocalBusiness"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  schema.org
                </a>{" "}
                vocabulary.
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
                  href={CALL_HREF}
                  {...newTabProps(CALL_HREF)}
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
        primary={{ href: CALL_HREF, label: "Book a free call" }}
        secondary={{ href: "/free-check", label: "Start with a free check" }}
        footnote={`${priceNote()} We promise the work, never a Google or AI position.`}
      />
    </>
  );
}
