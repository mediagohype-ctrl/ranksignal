import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { SampleResult } from "@/components/marketing/home-sample";
import { FAQS } from "@/components/marketing/content";
import { MARKETING_PLANS, TRIAL_DAYS, inr } from "@/components/marketing/plans";

// Home page: exactly five blocks (brief §5.1) — hero, sample result, three steps, three plans, five questions.

const TITLE = `${BRAND.name} — Check how Google and AI see your business`;
const DESCRIPTION =
  "Free website check for small businesses. See how Google and AI assistants like ChatGPT see your business, get your top fixes in plain words, and fix them with your OK.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ["SEO", "AEO", "GEO", "AI search", "ChatGPT visibility", "website check", "small business India"],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: BRAND.tagline,
    url: "/",
    siteName: BRAND.name,
    type: "website",
  },
};

const SITE = BRAND.appUrl.replace(/\/$/, "");

// The three names the report scores you on, each with what it means in plain words.
const TERMS = [
  { term: "SEO", name: "Search engines", line: "Can Google and Bing find, read and trust your pages?" },
  { term: "AEO", name: "Answer engines", line: "Do your pages give short, direct answers worth quoting?" },
  { term: "GEO", name: "Generative AI", line: "Do ChatGPT, Gemini and others name you and link to you?" },
];

const STEPS = [
  { title: "Check", body: "Type your website. We read it and ask ChatGPT, Gemini and others the questions your customers ask." },
  { title: "Fix", body: "You get a short to-do list, most useful first. Each fix says what to change, in plain words." },
  { title: "Grow", body: "Approve the fixes you want. We check again every month so you can see what changed." },
];

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: BRAND.name,
      url: SITE,
      logo: `${SITE}/brand/logo-mark-512.png`,
      email: BRAND.supportEmail,
      description: BRAND.tagline,
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BRAND.supportEmail, url: `${SITE}/contact` },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: BRAND.name,
      url: SITE,
      description: BRAND.tagline,
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: BRAND.name,
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Audits websites for SEO, answer-engine (AEO) and generative-AI (GEO) readiness and measures how often AI assistants mention and cite a brand.",
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
            <h1 id="hero-title" className="mk-hero mk-rise text-fg">
              Check. Fix. <span className="text-primary">Grow.</span>
            </h1>
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

      {/* ------------------------------------------------------------ 3. Check → Fix → Grow */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 py-20 sm:py-28">
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
            {STEPS.map((s, i) => (
              <li key={s.title} className="mk-reveal border-t border-fg pt-6">
                <span aria-hidden className="text-small font-medium tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[1.5rem] font-semibold tracking-[-0.02em] text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ 4. Three plans */}
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
                <Link href={p.id === "agency" ? "/contact" : `/signup?plan=${p.id}`} className={inkPill("md", false, "mt-8 w-full")}>
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

      {/* ------------------------------------------------------------ 5. Five questions */}
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
