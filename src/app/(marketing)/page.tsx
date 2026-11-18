import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ListChecks, Search, TrendingUp } from "lucide-react";
import { BRAND, bookCallHref } from "@/lib/brand";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { SampleResult } from "@/components/marketing/home-sample";
import { BusinessKinds } from "@/components/marketing/business-kinds";
import { DFY_ENGINE_COUNT, SELF_ENGINE_LIST } from "@/components/marketing/engine-names";
import { FAQS } from "@/components/marketing/content";
import { isFeatureLive } from "@/components/marketing/features/categories";
import {
  CUSTOM_CONTACT_HREF,
  CUSTOM_PLAN,
  DFY_PLAN,
  SELF_PLAN,
  TRIAL_DAYS,
  freq,
  gstOn,
  inr,
  planSignupHref,
  newTabProps,
} from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import { ProductTour, tourSummary } from "@/components/marketing/visuals/tour";
import { PlaceArt, StepArt } from "@/components/marketing/visuals/steps";
import { AiFoundSection } from "@/components/marketing/visuals/ai-found";
import { AiPositionsSection } from "@/components/marketing/visuals/ai-positions";

// Home page (Full Site Audit, 15 Nov 2026). Server-rendered HTML + inline SVG, every word crawlable. Nothing here
// reads cookies or headers, so the page is built once and served from cache (see the marketing layout).
// Order: hero (tagline + "Customers are searching…" + website box) → the problem in 3 cards (SEO / AEO / GEO) →
// sample result → three steps → kinds of business → everything in one app (live features only) → plans →
// questions → dark closing band with the website box again.

// Title leads with the phrases buyers search ("SEO", "AEO", "GEO", "AI visibility") — the brand comes last.
// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/", {
  keywords: ["SEO checker", "website SEO report", "AEO", "GEO", "AI search visibility", "ChatGPT SEO", "SEO company India"],
});

const SITE = BRAND.appUrl.replace(/\/$/, "");

// The tagline stays the big line in the hero (team decision, 15 Nov 2026); its last word carries the brand colour.
const SLOGAN_WORDS = BRAND.slogan.split(" ");
const SLOGAN_LEAD = SLOGAN_WORDS.slice(0, -1).join(" ");
const SLOGAN_LAST = SLOGAN_WORDS[SLOGAN_WORDS.length - 1];

// True on both offers: Do it myself never changes a website (the owner pastes each fix); on Do it for me our team
// asks for an OK first. No "undo" here — that only exists where we publish.
const TICKS = ["Plain words", "Nothing changes without your OK", "Help on WhatsApp", "No card needed to start"];

// One search, three places to be found. Replaces the long SEO / AEO / GEO explainer.
const PLACES = [
  { term: "SEO", title: "Google page 1", body: "People still search on Google. Is your business on the first page?" },
  { term: "AEO", title: "Google’s answer box", body: "Google now answers many questions itself, at the top. Does it quote you?" },
  { term: "GEO", title: "ChatGPT names 2–3 businesses", body: "Ask an AI assistant who to choose and it names only a few. Are you one?" },
];

/** "every week" / "every day" / "every month", from the plan's real limits. */
const EVERY: Record<string, string> = { Daily: "every day", Weekly: "every week", Monthly: "every month" };
const WEBSITE_CHECK_EVERY = EVERY[freq(SELF_PLAN.limits.minScanIntervalDays)] ?? "every month";
/** How often the plan's monthly AI answers let us ask the AI tools (4 or more full checks a month = every week). */
const AI_CHECK_EVERY = SELF_PLAN.ai.checksPerMonth >= 4 ? "every week" : "every month";

/** "₹1,999/month + GST" — one GST mention per price, none when we are not GST-registered. */
const monthly = (n: number) => `${inr(n)}/month${gstOn() ? " + GST" : ""}`;

// Website Blueprint: two priced plans + Custom. The middle (done-for-you) card is dark and shows first on phones.
const HOME_PLANS = [
  {
    key: "self",
    name: "I'll do it myself",
    price: monthly(SELF_PLAN.price),
    line: SELF_PLAN.blurb,
    start: `${TRIAL_DAYS} days free. No card needed. Cancel any time.`,
    cta: SELF_PLAN.cta,
    href: planSignupHref(SELF_PLAN.id),
    dark: false,
    points: [
      "Your SEO, AEO, GEO and Brand scores",
      `A website check ${WEBSITE_CHECK_EVERY}, up to ${SELF_PLAN.limits.maxPagesPerCrawl.toLocaleString("en-IN")} pages`,
      `We ask ${SELF_ENGINE_LIST} about you ${AI_CHECK_EVERY}`,
      "A to-do list in plain words, most important first",
      SELF_FIX_LINE,
      "A monthly report you can read in 2 minutes",
    ],
    whoDoes: "You make the fixes, with our step-by-step help.",
  },
  {
    key: "dfy",
    name: DFY_PLAN.name,
    price: monthly(DFY_PLAN.price),
    line: "Our team does all the work.",
    start: `Free 30-minute call.${DFY_PLAN.setup === 0 ? " No setup fee." : ""}`,
    cta: "Book a free call",
    // The calendar when BRAND_BOOKING_URL is set (opens in a new tab), otherwise the contact page.
    href: bookCallHref(),
    dark: true,
    points: [
      "Everything in I'll do it myself",
      "Our team fixes your website, most important first",
      "Your Google Business Profile looked after",
      "New pages that answer what your customers ask",
      "Wrong facts about you in AI answers corrected",
      "Your own expert on WhatsApp, plus a monthly call",
    ],
    whoDoes: "Our team does the work. You just reply OK.",
  },
  {
    key: "custom",
    name: CUSTOM_PLAN.name,
    price: CUSTOM_PLAN.priceLabel,
    line: CUSTOM_PLAN.blurb,
    start: CUSTOM_PLAN.start,
    cta: CUSTOM_PLAN.cta,
    href: CUSTOM_CONTACT_HREF,
    dark: false,
    points: [...CUSTOM_PLAN.includes],
    whoDoes: "A dedicated team, with one point of contact.",
  },
];

const STEPS = [
  { title: "Check", icon: Search, body: `Type your website. We read it and ask ${SELF_ENGINE_LIST} what your customers ask.` },
  { title: "Fix", icon: ListChecks, body: "You get a short to-do list, most useful first. Each fix says what to change, in plain words." },
  {
    title: "Grow",
    icon: TrendingUp,
    body: `You make the fixes with our steps, or our team does them for you. We check ${WEBSITE_CHECK_EVERY}.`,
  },
];

const linkCls = "font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg";

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
      description: `Website SEO audit and report tool that scores SEO, answer-engine (AEO) and generative-AI (GEO) readiness and measures how often AI tools such as ${SELF_ENGINE_LIST} mention and cite a brand.`,
      // Only what every customer really gets, worded per offer: Do it myself has ready-to-paste fixes (no
      // publishing, so no "approval-gated fixes with rollback"); on Do it for me our team makes the changes.
      featureList: [
        "Website SEO audit and report",
        "AEO (answer engine optimization) score",
        "GEO (generative engine optimization) score",
        `AI visibility tracking in ${SELF_ENGINE_LIST} (up to ${DFY_ENGINE_COUNT} AI tools on ${DFY_PLAN.name})`,
        "Competitor share of voice in AI answers",
        "Ready-to-paste fixes with step-by-step help",
        "Done-for-you fixes by our team",
        "Core Web Vitals page speed checks",
        "Alerts when scores, pages or AI answers change",
        "Client report builder",
        "Portfolio view for many websites",
        "Public API and MCP server",
        `IndexNow submission to Bing and other search engines (${DFY_PLAN.name} and ${CUSTOM_PLAN.name})`,
        "AI crawler visit tracking",
        "Internal link suggestions",
        // Needs Google's Places data: listed only once it is switched on (same check as /features).
        ...(isFeatureLive("maps-data") ? ["Google Business Profile monitor"] : []),
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

      {/* ------------------------------------------------------------ 1. Hero: tagline, the question, one website box */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className="container-marketing pb-14 pt-10 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            {/* The one H1 carries the searched phrase; the tagline stays as the big visual line. */}
            <h1 id="hero-title" className="mk-label text-primary">
              Free SEO, AEO &amp; GEO website checker
            </h1>
            <p className="mk-hero mt-4 text-fg">
              {SLOGAN_LEAD} <span className="text-primary">{SLOGAN_LAST}</span>
            </p>
            <h2 className="mk-title mx-auto mt-6 max-w-[22ch] text-balance text-fg sm:mt-8">
              Customers are searching. Are they finding you?
            </h2>
            <p className="mk-lead mx-auto mt-4 max-w-[36rem] text-fg-soft">
              Free SEO and AI checker. See how Google and ChatGPT see your business, in 30 seconds.
            </p>
            <FreeCheckLauncher
              id="hero-url"
              className="mx-auto mt-7 max-w-[36rem] text-left"
              hint={`Free · No sign-up · ${BRAND.proof}`}
            />
            {/* One row on laptops; on phones a tidy 2 × 2 grid instead of an orphaned last tick. */}
            <ul className="mx-auto mt-6 grid max-w-md grid-cols-2 justify-items-start gap-x-4 gap-y-2 text-left text-small text-fg-soft sm:flex sm:max-w-none sm:flex-nowrap sm:justify-center sm:gap-x-5">
              {TICKS.map((t) => (
                <li key={t} className="inline-flex items-start gap-1.5 sm:items-center sm:whitespace-nowrap">
                  <Check aria-hidden size={15} className="mt-[3px] shrink-0 text-success sm:mt-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 2. The problem: three places customers look */}
      <section id="where-found" aria-labelledby="where-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-16 sm:py-24">
        <div className="container-marketing">
          <div className="mk-reveal max-w-2xl">
            <h2 id="where-title" className="mk-title text-fg">
              Your customers changed how they search.
            </h2>
            <p className="mk-body mt-4 text-fg-soft">
              One search, three places to be found. {BRAND.name} checks all three and shows you what to fix first.
            </p>
          </div>
          <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {PLACES.map((p) => (
              <li key={p.term} className="mk-reveal rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
                <PlaceArt place={p.term} className="mb-5" />
                <p className="inline-flex h-7 items-center rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary-soft-fg">{p.term}</p>
                <h3 className="mt-4 text-[1.25rem] font-semibold tracking-[-0.015em] text-fg">{p.title}</h3>
                <p className="mt-2 text-[1rem] leading-relaxed text-fg-soft">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ 2b. Where each AI puts you */}
      <AiPositionsSection />

      {/* ------------------------------------------------------------ 2c. Our difference: found inside AI assistants */}
      <AiFoundSection />

      {/* ------------------------------------------------------------ 3. Sample result */}
      <section id="sample" aria-labelledby="sample-title" className="scroll-mt-20 border-t border-border py-16 sm:py-24">
        <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="mk-reveal lg:col-span-5">
            <p className="mk-label">What you get</p>
            <h2 id="sample-title" className="mk-title mt-4 max-w-[16ch] text-fg">
              One score. Your top fixes.
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              One score out of 100, and the three fixes that help most — each with how many points it can add.
            </p>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
            <SampleResult />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 4. Check → Fix → Grow */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-16 sm:py-24">
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
          <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const last = i === STEPS.length - 1;
              return (
                <li key={s.title} className="mk-reveal relative sm:flex sm:flex-col">
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
                  {/* On wider screens every step is the same height and the text grows, so all three pictures line up. */}
                  <div className="-mt-12 pl-[4.25rem] sm:mt-0 sm:flex sm:flex-1 sm:flex-col sm:pl-0">
                    <h3 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em] text-fg sm:mt-5">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mk-body mt-3 max-w-[22rem] text-fg-soft sm:flex-1">{s.body}</p>
                    <StepArt step={s.title} className="mt-5 max-w-[22rem]" />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ 5. Kinds of business (tabs without JavaScript) */}
      <section id="who-its-for" aria-labelledby="kinds-title" className="scroll-mt-20 border-t border-border py-16 sm:py-24">
        <div className="container-marketing">
          <h2 id="kinds-title" className="mk-reveal mk-title max-w-[20ch] text-fg">
            Whatever you sell, people ask before they buy.
          </h2>
          <BusinessKinds className="mk-reveal mt-8" />
        </div>
      </section>

      {/* ------------------------------------------------------------ 6. Everything in one app (live features only) */}
      <section id="product" aria-labelledby="product-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-16 sm:py-24">
        <div className="container-marketing">
          <div className="mk-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="product-title" className="mk-title text-fg">
                Everything in one app.
              </h2>
              {/* Built from the same on/off checks as the tiles below, so it never lists a part that is not live. */}
              <p className="mk-body mt-4 text-fg-soft">Your {tourSummary({ liveOnly: true })}, in one place and in plain words.</p>
            </div>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              See all features
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
          <ProductTour liveOnly className="mt-10" />
        </div>
      </section>

      {/* ------------------------------------------------------------ 7. Three plans */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-t border-border py-16 sm:py-24">
        <div className="container-marketing">
          <div className="mk-reveal max-w-2xl">
            <h2 id="pricing-title" className="mk-title text-fg">
              Pick your plan
            </h2>
            <p className="mk-body mt-4 text-fg-soft">{gstOn() ? "Prices in ₹. GST extra. No hidden costs." : "Prices in ₹. No hidden costs."}</p>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
            {HOME_PLANS.map((p) => (
              <li
                key={p.key}
                className={
                  "mk-reveal flex flex-col rounded-2xl p-6 sm:p-8 " +
                  (p.dark ? "order-first bg-fg text-bg shadow-card lg:order-none lg:-my-3 lg:py-11" : "border border-border bg-surface shadow-card")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className={"text-h4 " + (p.dark ? "text-bg" : "text-fg")}>{p.name}</h3>
                  {p.dark && <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-fg">Most chosen</span>}
                </div>
                <p className={"mt-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] tabular-nums " + (p.dark ? "text-bg" : "text-fg")}>
                  {p.price}
                </p>
                <p className={"mt-3 text-small " + (p.dark ? "text-bg/80" : "text-fg-soft")}>{p.line}</p>
                <p className={"mt-2 text-small font-medium " + (p.dark ? "text-bg" : "text-fg")}>{p.start}</p>

                <div className={"mt-6 flex-1 border-t pt-6 " + (p.dark ? "border-bg/15" : "border-border")}>
                  <p className={"text-xs font-semibold uppercase tracking-[0.06em] " + (p.dark ? "text-bg/70" : "text-muted")}>
                    What you get
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {p.points.map((pt) => (
                      <li key={pt} className={"flex gap-2.5 text-small " + (p.dark ? "text-bg/90" : "text-fg-soft")}>
                        <Check aria-hidden size={16} className={"mt-0.5 shrink-0 " + (p.dark ? "text-bg" : "text-success")} />
                        {pt}
                      </li>
                    ))}
                  </ul>

                  <p className={"mt-6 text-small italic " + (p.dark ? "text-bg/80" : "text-fg-soft")}>{p.whoDoes}</p>
                </div>

                <Link
                  href={p.href}
                  {...newTabProps(p.href)}
                  className={
                    p.dark
                      ? inkPill("md", true, "mt-8 h-12 w-full")
                      : "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border border-border-strong px-5 text-small font-medium text-fg hover:bg-surface-2"
                  }
                >
                  {p.cta}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-small text-muted">
            <Link href="/pricing" className={linkCls}>
              See what each plan includes
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 8. Questions */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-16 sm:py-24">
        <div className="container-marketing grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 id="faq-title" className="mk-title max-w-[12ch] text-fg">
                Questions, answered plainly.
              </h2>
              <p className="mk-body mt-5 max-w-sm text-fg-soft">
                Something else?{" "}
                <Link href="/contact" className={linkCls}>
                  Write to us
                </Link>{" "}
                or read{" "}
                <Link href="/about" className={linkCls}>
                  about us
                </Link>
                .
              </p>
              <p className="mt-5 max-w-sm text-small text-muted">
                Our checks follow public standards: Google&apos;s{" "}
                <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide" rel="noopener" className={linkCls}>
                  SEO Starter Guide
                </a>
                ,{" "}
                <a href="https://schema.org/docs/gs.html" rel="noopener" className={linkCls}>
                  schema.org
                </a>{" "}
                and the{" "}
                <a href="https://datatracker.ietf.org/doc/html/rfc9309" rel="noopener" className={linkCls}>
                  robots.txt standard
                </a>
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

      {/* ------------------------------------------------------------ 9. Closing band: the website box again */}
      <section aria-labelledby="final-title" className="bg-fg text-bg">
        <div className="container-marketing py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="final-title" className="mk-statement text-balance text-bg">
              Every day you wait, customers find someone else.
            </h2>
            <FreeCheckLauncher id="final-url" onDark className="mx-auto mt-9 max-w-[36rem] text-left" hint="Free · No sign-up · Takes about 30 seconds" />
          </div>
        </div>
      </section>
    </>
  );
}
