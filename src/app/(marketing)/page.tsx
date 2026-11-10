import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ListChecks, Search, TrendingUp } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { SampleResult } from "@/components/marketing/home-sample";
import { FAQS } from "@/components/marketing/content";
import { MARKETING_PLANS, TRIAL_DAYS, inr, planSignupHref } from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import { ReachVisual } from "@/components/marketing/visuals/reach";
import { ProductTour } from "@/components/marketing/visuals/tour";
import { StepArt } from "@/components/marketing/visuals/steps";

// Home page, made more visual on the CEO's request (still server-rendered HTML + inline SVG, every word crawlable):
// hero, sample result, where customers find you (SEO/AEO/GEO), three steps, everything in one app, three plans, questions.

// Title leads with the phrases buyers search ("SEO", "AEO", "GEO", "AI visibility") — the brand comes last.
// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/", {
  keywords: ["SEO checker", "website SEO report", "AEO", "GEO", "AI search visibility", "ChatGPT SEO", "SEO company India"],
});

const SITE = BRAND.appUrl.replace(/\/$/, "");

// The three names the report scores you on, each with what it means in plain words.
const TERMS = [
  { term: "SEO", name: "Search engines", line: "Can Google and Bing find, read and trust your pages?" },
  { term: "AEO", name: "Answer engines", line: "Do your pages give short, direct answers worth quoting?" },
  { term: "GEO", name: "Generative AI", line: "Do ChatGPT, Gemini and others name you and link to you?" },
];

const STEPS = [
  { title: "Check", icon: Search, body: "Type your website. We read it and ask ChatGPT, Gemini and others the questions your customers ask." },
  { title: "Fix", icon: ListChecks, body: "You get a short to-do list, most useful first. Each fix says what to change, in plain words." },
  { title: "Grow", icon: TrendingUp, body: "Approve the fixes you want. We check again every month so you can see what changed." },
];

export default function HomePage() {
  // Organization + WebSite come from the marketing layout (sitewide); this page adds the product itself.
  const jsonLd = [
    webPageLd("/", { base: SITE }),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: BRAND.name,
      url: `${SITE}/`,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "SEO software",
      operatingSystem: "Web",
      description:
        "Website SEO audit and report tool that scores SEO, answer-engine (AEO) and generative-AI (GEO) readiness and measures how often ChatGPT, Gemini, Perplexity and Claude mention and cite a brand.",
      featureList: [
        "Website SEO audit and report",
        "AEO (answer engine optimization) score",
        "GEO (generative engine optimization) score",
        "AI visibility tracking in ChatGPT, Gemini, Perplexity, Claude and Grok",
        "Competitor share of voice in AI answers",
        "Approval-gated fixes with rollback",
        "Core Web Vitals page speed checks",
        "Alerts when scores, pages or AI answers change",
        "Client report builder",
        "Portfolio view for many websites",
        "Public API and MCP server",
        "IndexNow submission to Bing and other search engines",
        "Google Business Profile monitor",
        "AI crawler visit tracking",
        "Internal link suggestions",
        // Paid Google-data features: listed only once our data partner is switched on.
        ...(dfsConfigured() ? ["Google rank tracking", "Keyword research", "Competitor analysis"] : []),
        ...(backlinksEnabled() ? ["Backlink checker"] : []),
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "Free website check, no sign-up" },
      publisher: { "@id": `${SITE}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ------------------------------------------------------------ 1. Hero: one website box */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            {/* The H1 carries the searched phrase; the big slogan stays as the visual headline. */}
            <h1 id="hero-title" className="mk-label mk-rise text-primary">
              Free SEO, AEO &amp; GEO website checker
            </h1>
            <p className="mk-hero mk-rise mt-5 text-fg">
              Check. Fix. <span className="text-primary">Grow.</span>
            </p>
            <p className="mk-lead mk-rise mk-delay-1 mx-auto mt-8 max-w-[36rem] text-fg-soft">
              See how Google and AI assistants like ChatGPT see your business. Get your top fixes in plain words, so
              customers can find you more easily.
            </p>
            <FreeCheckLauncher id="hero-url" className="mk-rise mk-delay-2 mx-auto mt-9 max-w-[36rem] text-left" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 2. Sample result */}
      <section id="sample" aria-labelledby="sample-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="mk-reveal lg:col-span-5">
            <p className="mk-label">What you get</p>
            <h2 id="sample-title" className="mk-title mt-4 max-w-[16ch] text-fg">
              One score. Your top fixes.
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              In about 30 seconds you see one score out of 100 and the three fixes that help most — each with how many
              points it can add.
            </p>
            <dl className="mt-8 space-y-4">
              {TERMS.map((t) => (
                <div key={t.term} className="flex gap-4">
                  <dt className="w-14 shrink-0 font-semibold text-primary">{t.term}</dt>
                  <dd className="text-fg-soft">
                    <span className="font-medium text-fg">{t.name}.</span> {t.line}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mk-body mt-6 max-w-md text-small text-muted">
              SEO, AEO and GEO are three names for one goal: when someone looks for what you sell, they find you.
            </p>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
            <SampleResult />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 3. Where your customers find you */}
      <section id="where-found" aria-labelledby="where-title" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal mx-auto max-w-3xl text-center">
            <p className="mk-label">SEO, AEO and GEO</p>
            <h2 id="where-title" className="mk-title mx-auto mt-4 max-w-[18ch] text-fg">
              Where your customers find you
            </h2>
            <h3 className="mt-8 text-[1.25rem] font-semibold tracking-[-0.015em] text-fg">
              What do SEO, AEO and GEO mean for my business?
            </h3>
            <p className="mk-body mx-auto mt-3 max-w-[42rem] text-fg-soft">
              They are three ways the same customer can find you. SEO (search engine optimization) gets your website
              into Google&apos;s normal results. AEO (answer engine optimization) makes your pages give short, clear
              answers that Google&apos;s answer box and AI Overviews can quote. GEO (generative engine optimization) helps
              AI assistants like ChatGPT, Gemini and Perplexity name your business and link to your website when someone
              asks for what you sell. Do well at all three and you are there wherever your customers look.{" "}
              {BRAND.name} checks all three and tells you what to fix first.
            </p>
          </div>
          <ReachVisual className="mk-reveal mt-12 lg:mt-16" />
        </div>
      </section>

      {/* ------------------------------------------------------------ 4. Check → Fix → Grow */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="how-title" className="mk-title max-w-[16ch] text-fg">
              Three steps. About a minute to start.
            </h2>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              How it works
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const last = i === STEPS.length - 1;
              return (
                <li key={s.title} className="mk-reveal relative">
                  {/* Connecting line to the next step: down on phones, across on wider screens. */}
                  {!last && (
                    <>
                      <span aria-hidden className="absolute -bottom-10 left-6 top-14 border-l-2 border-dashed border-primary/35 sm:hidden" />
                      <span aria-hidden className="absolute -right-6 left-16 top-6 hidden border-t-2 border-dashed border-primary/35 sm:block" />
                    </>
                  )}
                  <span aria-hidden className="relative inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-card">
                    <Icon size={22} />
                    <span className="absolute -right-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border border-primary/30 bg-surface text-[11px] font-semibold tabular-nums text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <div className="-mt-12 pl-[4.25rem] sm:mt-0 sm:pl-0">
                    <h3 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em] text-fg sm:mt-5">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.body}</p>
                    <StepArt step={s.title} className="mt-5 max-w-[22rem]" />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ 5. Everything in one app */}
      <section id="product" aria-labelledby="product-title" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="product-title" className="mk-title text-fg">
                Everything in one app.
              </h2>
              <p className="mk-body mt-4 text-fg-soft">
                Your website score, AI answers, fixes, page speed, rankings, keywords, competitors and backlinks, in one
                place and in plain words.
              </p>
            </div>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              See all features
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
          <ProductTour className="mt-10 lg:mt-12" />
        </div>
      </section>

      {/* ------------------------------------------------------------ 6. Three plans */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal max-w-2xl">
            <h2 id="pricing-title" className="mk-title text-fg">
              Simple plans. {TRIAL_DAYS} days free.
            </h2>
            <p className="mk-body mt-4 text-fg-soft">Prices in Indian rupees, plus GST. Cancel any time.</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {MARKETING_PLANS.map((p) => (
              <li
                key={p.id}
                className={
                  "mk-reveal flex flex-col rounded-2xl border bg-surface p-6 shadow-card sm:p-8 " +
                  (p.featured ? "border-primary ring-1 ring-primary" : "border-border")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-h4 text-fg">{p.name}</h3>
                  {p.featured && (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-soft-fg">Most popular</span>
                  )}
                </div>
                <p className="mt-4 text-[2.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg">
                  {inr(p.price)}
                  {p.suffix}
                  <span className="ml-1 text-small font-normal tracking-normal text-muted">/ month</span>
                </p>
                <p className="mt-4 text-small text-fg-soft">{p.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.highlights.slice(0, 4).map((h) => (
                    <li key={h} className="flex gap-3 text-small text-fg-soft">
                      <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-primary" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Link href={planSignupHref(p.id)} className={inkPill("md", false, "mt-8 w-full")}>
                  {p.cta}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-small text-muted">
            <Link href="/pricing" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              Compare plans in detail
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 7. Questions */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 id="faq-title" className="mk-title max-w-[12ch] text-fg">
                Questions, answered plainly.
              </h2>
              <p className="mk-body mt-5 max-w-sm text-fg-soft">
                Something else on your mind?{" "}
                <Link href="/contact" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                  Write to us
                </Link>
                .
              </p>
              <p className="mk-body mt-5 max-w-sm text-fg-soft">
                Our checks follow public standards, such as Google&apos;s{" "}
                <a
                  href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  SEO Starter Guide
                </a>
                , the{" "}
                <a
                  href="https://schema.org/docs/gs.html"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  schema.org
                </a>{" "}
                vocabulary and the{" "}
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc9309"
                  rel="noopener"
                  className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  robots.txt standard
                </a>
                . Read more{" "}
                <Link href="/about" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                  about us
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="border-t border-fg lg:col-span-7 lg:col-start-6">
            {FAQS.map((f) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
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
        </div>
      </section>
    </>
  );
}
